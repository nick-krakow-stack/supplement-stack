import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import {
  createDoseRecommendation,
  deleteDoseRecommendation,
  getAllIngredients,
  getDoseRecommendations,
  getIngredientResearchDetail,
  updateDoseRecommendation,
  type AdminDoseRecommendation,
  type AdminDosePlausibilityWarning,
  type AdminIngredientResearchSource,
  type IngredientLookup,
} from '../../api/admin';
import AdministratorDosingEditPanel from './AdministratorDosingEditPanel';
import {
  type DoseDraft,
  type SelectedDoseId,
  type SourceLinkDraft,
  blankDoseDraft,
  doseLabel,
  draftFromRecommendation,
  getErrorMessage,
  parseIntOrNull,
  payloadFromDraft,
  sourceLinksFromRecommendation,
  validateDosePayload,
} from './AdministratorDosingTypes';
import { AdminBadge, AdminButton, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

function statusChip(label: string, active: boolean, tone: 'green' | 'blue' | 'amber' = 'blue') {
  if (!active) return <AdminBadge>{label}</AdminBadge>;
  return <AdminBadge tone={tone === 'green' ? 'ok' : tone === 'amber' ? 'warn' : 'info'}>{label}</AdminBadge>;
}

type SourceStatusFilter = '' | 'official' | 'with-studies' | 'without-studies';
type LinkTypeFilter = '' | 'internal' | 'external' | 'none';

function isHiddenAdminDose(row: AdminDoseRecommendation, ingredientName: string): boolean {
  const normalizedName = ingredientName.trim().toLowerCase();
  if (normalizedName === 'eha' || normalizedName === 'dpa') return true;
  if (row.created_by_user_id != null) return true;
  return false;
}

function hasOfficialSource(row: AdminDoseRecommendation): boolean {
  const haystack = [
    row.source_type,
    row.source_label,
    row.source_url,
    ...(row.sources ?? []).flatMap((source) => [
      source.source_kind,
      source.source_title,
      source.source_url,
      source.organization,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\b(official|dge|efsa|bfr|nih|ods|rki|who|beh[oö]rde|leitlinie)\b/.test(haystack);
}

function hasStudySource(row: AdminDoseRecommendation): boolean {
  if ((row.sources ?? []).length > 0) return true;
  const haystack = [row.source_type, row.source_label, row.source_url].filter(Boolean).join(' ').toLowerCase();
  return /\b(study|studie|rct|meta|review|pubmed|doi|pmid)\b/.test(haystack);
}

function getPrimarySourceUrl(row: AdminDoseRecommendation): string {
  return row.source_url || row.sources?.find((source) => source.is_primary === 1)?.source_url || row.sources?.find((source) => source.source_url)?.source_url || '';
}

function getLinkType(row: AdminDoseRecommendation): LinkTypeFilter {
  const url = getPrimarySourceUrl(row).trim();
  if (!url) return 'none';
  if (url.startsWith('/') || url.startsWith('#')) return 'internal';
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin ? 'internal' : 'external';
  } catch {
    return 'external';
  }
}

function sourceStatusMatches(row: AdminDoseRecommendation, filter: SourceStatusFilter): boolean {
  if (!filter) return true;
  if (filter === 'official') return hasOfficialSource(row);
  const hasStudies = hasStudySource(row);
  if (filter === 'with-studies') return hasStudies;
  return !hasStudies;
}

export default function AdministratorDosingPage() {
  const [recommendations, setRecommendations] = useState<AdminDoseRecommendation[]>([]);
  const [ingredients, setIngredients] = useState<IngredientLookup[]>([]);
  const [researchSources, setResearchSources] = useState<AdminIngredientResearchSource[]>([]);
  const [selectedId, setSelectedId] = useState<SelectedDoseId>(null);
  const [draft, setDraft] = useState<DoseDraft>(() => blankDoseDraft());
  const [sourceLinks, setSourceLinks] = useState<SourceLinkDraft[]>([]);
  const [query, setQuery] = useState('');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [sourceStatusFilter, setSourceStatusFilter] = useState<SourceStatusFilter>('');
  const [linkTypeFilter, setLinkTypeFilter] = useState<LinkTypeFilter>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [backendWarnings, setBackendWarnings] = useState<AdminDosePlausibilityWarning[]>([]);

  const selectedRecommendation = useMemo(() => {
    if (typeof selectedId !== 'number') return null;
    return recommendations.find((entry) => entry.id === selectedId) ?? null;
  }, [recommendations, selectedId]);

  const ingredientOptions = useMemo(
    () => [
      { value: '', label: 'Alle Wirkstoffe' },
      ...ingredients.map((ingredient) => ({ value: String(ingredient.id), label: ingredient.name })),
    ],
    [ingredients],
  );

  const ingredientNameById = useMemo(() => {
    const map = new Map<number, string>();
    ingredients.forEach((ingredient) => map.set(ingredient.id, ingredient.name));
    return map;
  }, [ingredients]);

  const loadIngredients = useCallback(async () => {
    try {
      setIngredients(await getAllIngredients());
    } catch {
      setIngredients([]);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getDoseRecommendations({
        q: query,
        limit: 100,
        ingredient_id: ingredientFilter ? Number(ingredientFilter) : undefined,
      });
      const rows = response.recommendations.filter((row) => {
        const ingredientName = row.ingredient_name || ingredientNameById.get(row.ingredient_id ?? 0) || '';
        if (isHiddenAdminDose(row, ingredientName)) return false;
        if (!sourceStatusMatches(row, sourceStatusFilter)) return false;
        if (linkTypeFilter && getLinkType(row) !== linkTypeFilter) return false;
        return true;
      });
      setRecommendations(rows);
      setSelectedId((previous) => {
        if (previous === 'new') return previous;
        if (typeof previous === 'number' && rows.some((row) => row.id === previous)) return previous;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setRecommendations([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [ingredientFilter, ingredientNameById, linkTypeFilter, query, sourceStatusFilter]);

  useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    if (selectedId === 'new') {
      setDraft((previous) => ({
        ...blankDoseDraft(),
        ingredient_id: ingredientFilter || previous.ingredient_id,
      }));
      setSourceLinks([]);
      setStatus('');
      setBackendWarnings([]);
      return;
    }
    if (selectedRecommendation) {
      setDraft(draftFromRecommendation(selectedRecommendation));
      setSourceLinks(sourceLinksFromRecommendation(selectedRecommendation));
      setStatus('');
      setBackendWarnings(selectedRecommendation.plausibility_warnings ?? []);
    }
  }, [ingredientFilter, selectedId, selectedRecommendation]);

  useEffect(() => {
    const ingredientId = parseIntOrNull(draft.ingredient_id);
    if (!ingredientId) {
      setResearchSources([]);
      return;
    }
    let cancelled = false;
    getIngredientResearchDetail(ingredientId)
      .then((detail) => {
        if (!cancelled) setResearchSources(detail.sources);
      })
      .catch(() => {
        if (!cancelled) setResearchSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.ingredient_id]);

  const updateDraft = (field: keyof DoseDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setStatus('');
  };

  const updateSourceLink = (index: number, field: keyof SourceLinkDraft, value: string | boolean) => {
    setSourceLinks((previous) =>
      previous.map((source, currentIndex) => {
        if (currentIndex !== index) {
          return field === 'is_primary' && value === true ? { ...source, is_primary: false } : source;
        }
        return { ...source, [field]: value };
      }),
    );
    setStatus('');
  };

  const addSourceLink = () => {
    setSourceLinks((previous) => [
      ...previous,
      { research_source_id: '', relevance_weight: '50', is_primary: previous.length === 0, note: '' },
    ]);
  };

  const removeSourceLink = (index: number) => {
    setSourceLinks((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
    setStatus('');
  };

  const handleNew = () => {
    setSelectedId('new');
    setDraft({ ...blankDoseDraft(), ingredient_id: ingredientFilter });
    setSourceLinks([]);
    setBackendWarnings([]);
  };

  const handleSave = async () => {
    const payload = payloadFromDraft(draft, sourceLinks);
    const validation = validateDosePayload(payload);
    if (validation) {
      setStatus(validation);
      return;
    }

    setSaving(true);
    setError('');
    setStatus('');
    setBackendWarnings([]);
    try {
      let nextSelectedId: number | null = typeof selectedId === 'number' ? selectedId : null;
      if (selectedId === 'new' || selectedId === null) {
        const created = await createDoseRecommendation(payload);
        nextSelectedId = created.id;
        setBackendWarnings(created.plausibility_warnings ?? []);
        setStatus(`Richtwert #${created.id} erstellt.`);
      } else {
        const updated = await updateDoseRecommendation(selectedId, {
          ...payload,
          version: selectedRecommendation?.version ?? null,
        });
        setBackendWarnings(updated.plausibility_warnings ?? []);
        setRecommendations((previous) =>
          previous.map((entry) => (entry.id === selectedId ? { ...entry, ...updated } : entry)),
        );
        setStatus(`Richtwert #${selectedId} gespeichert.`);
      }
      await loadRecommendations();
      if (nextSelectedId !== null) setSelectedId(nextSelectedId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (typeof selectedId !== 'number') return;
    if (!window.confirm('Richtwert deaktivieren?')) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await deleteDoseRecommendation(selectedId, { version: selectedRecommendation?.version ?? null });
      setStatus(`Richtwert #${selectedId} deaktiviert.`);
      await loadRecommendations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Richtwerte"
        subtitle="Dosierungen prüfen und mit Quellen belegen."
        meta={<AdminBadge tone="info">{recommendations.length} Richtwerte</AdminBadge>}
      />

      <div className="admin-filter-bar mb-4">
        <div className="admin-filter-main">
          <label className="admin-filter-search flex min-h-[34px] items-center gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3">
            <Search size={15} className="admin-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Wirkstoff, Quelle, Kontext suchen"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
            />
          </label>
        </div>
        <div className="admin-filter-controls">
          <select
            value={ingredientFilter}
            onChange={(event) => setIngredientFilter(event.target.value)}
            className="admin-select"
          >
            {ingredientOptions.map((option) => (
              <option key={option.value || option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={sourceStatusFilter}
            onChange={(event) => setSourceStatusFilter(event.target.value as SourceStatusFilter)}
            className="admin-select"
          >
            <option value="">Alle Quellen</option>
            <option value="official">Offiziell</option>
            <option value="with-studies">Studien vorhanden</option>
            <option value="without-studies">Keine Studien vorhanden</option>
          </select>
          <select
            value={linkTypeFilter}
            onChange={(event) => setLinkTypeFilter(event.target.value as LinkTypeFilter)}
            className="admin-select"
          >
            <option value="">Alle Links</option>
            <option value="internal">Interner Link</option>
            <option value="external">Externer Link</option>
            <option value="none">Kein Link</option>
          </select>
        </div>
        <div className="admin-filter-actions">
          <AdminButton onClick={handleNew}>
            <Plus size={15} />
            Neu
          </AdminButton>
          <AdminButton onClick={() => void loadRecommendations()}>
            <RefreshCw size={15} />
            Aktualisieren
          </AdminButton>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
        <section className="space-y-3">
          {loading ? (
            <AdminEmpty>
              <Loader2 size={16} className="mr-2 inline animate-spin" />
              Lade Richtwerte...
            </AdminEmpty>
          ) : recommendations.length === 0 ? (
            <AdminEmpty>Keine Richtwerte gefunden.</AdminEmpty>
          ) : (
            recommendations.map((row) => {
              const active = selectedId === row.id;
              const ingredientName = row.ingredient_name || ingredientNameById.get(row.ingredient_id ?? 0) || 'Wirkstoff';
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`admin-compact-card admin-card block w-full p-3 text-left transition-colors ${
                    active ? 'border-[color:var(--admin-green)] ring-2 ring-[rgba(74,176,107,0.18)]' : 'hover:bg-[color:var(--admin-bg-sunk)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                        {ingredientName}
                      </p>
                      <p className="mt-1 text-[13px] text-[color:var(--admin-ink-2)]">{doseLabel(row)}</p>
                    </div>
                    <AdminBadge>{row.source_type || 'source'}</AdminBadge>
                  </div>
                  <p className="admin-muted mt-2 text-xs">
                    {row.source_label || 'Kein Quellenname'} {row.context_note ? `- ${row.context_note}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {statusChip('default', row.is_default === 1, 'amber')}
                    {getLinkType(row) === 'internal' ? (
                      <AdminBadge tone="ok">Interner Link</AdminBadge>
                    ) : getLinkType(row) === 'external' ? (
                      <AdminBadge tone="danger">Externer Link</AdminBadge>
                    ) : (
                      <AdminBadge>Kein Link</AdminBadge>
                    )}
                    {row.sources?.length
                      ? statusChip(`${row.sources.length} Quellen`, true, 'green')
                      : statusChip('keine Links', false)}
                  </div>
                </button>
              );
            })
          )}
        </section>

        <AdministratorDosingEditPanel
          selectedId={selectedId}
          selectedRecommendation={selectedRecommendation}
          draft={draft}
          sourceLinks={sourceLinks}
          researchSources={researchSources}
          ingredientOptions={ingredientOptions}
          ingredientNameById={ingredientNameById}
          saving={saving}
          status={status}
          backendWarnings={backendWarnings}
          onDraftChange={updateDraft}
          onSourceLinkChange={updateSourceLink}
          onAddSourceLink={addSourceLink}
          onRemoveSourceLink={removeSourceLink}
          onSave={() => void handleSave()}
          onDeactivate={() => void handleDeactivate()}
        />
      </div>
    </>
  );
}
