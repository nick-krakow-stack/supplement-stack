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
  SOURCE_TYPES,
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

export default function AdministratorDosingPage() {
  const [recommendations, setRecommendations] = useState<AdminDoseRecommendation[]>([]);
  const [ingredients, setIngredients] = useState<IngredientLookup[]>([]);
  const [researchSources, setResearchSources] = useState<AdminIngredientResearchSource[]>([]);
  const [selectedId, setSelectedId] = useState<SelectedDoseId>(null);
  const [draft, setDraft] = useState<DoseDraft>(() => blankDoseDraft());
  const [sourceLinks, setSourceLinks] = useState<SourceLinkDraft[]>([]);
  const [query, setQuery] = useState('');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [publicFilter, setPublicFilter] = useState('');
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
        source_type: sourceTypeFilter || undefined,
        active: activeFilter || undefined,
        public: publicFilter || undefined,
      });
      const rows = response.recommendations;
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
  }, [activeFilter, ingredientFilter, publicFilter, query, sourceTypeFilter]);

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
        title="Dosis-Richtwerte"
        subtitle="Richtwerte, Quellen und verknüpfte Studien je Wirkstoff pflegen."
        meta={<AdminBadge tone="info">{recommendations.length} Richtwerte</AdminBadge>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
          <AdminButton onClick={handleNew}>
            <Plus size={15} />
            Neu
          </AdminButton>
          <AdminButton onClick={() => void loadRecommendations()}>
            <RefreshCw size={15} />
            Aktualisieren
          </AdminButton>
      </div>

      <section className="admin-toolbar mb-4 lg:grid-cols-[minmax(180px,1fr)_180px_150px_150px_150px]">
        <label className="flex min-h-[38px] items-center gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3">
          <Search size={16} className="admin-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Wirkstoff, Quelle, Kontext suchen"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
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
          value={sourceTypeFilter}
          onChange={(event) => setSourceTypeFilter(event.target.value)}
          className="admin-select"
        >
          <option value="">Alle Quellen</option>
          {SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
          className="admin-select"
        >
          <option value="">Aktiv/Inaktiv</option>
          <option value="1">Aktiv</option>
          <option value="0">Inaktiv</option>
        </select>
        <select
          value={publicFilter}
          onChange={(event) => setPublicFilter(event.target.value)}
          className="admin-select"
        >
          <option value="">Public/Privat</option>
          <option value="1">Public</option>
          <option value="0">Privat</option>
        </select>
      </section>

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
                  className={`admin-card block w-full p-4 text-left transition-colors ${
                    active ? 'border-[color:var(--admin-green)] ring-2 ring-[rgba(74,176,107,0.18)]' : 'hover:bg-[color:var(--admin-bg-sunk)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                        #{row.id} {ingredientName}
                      </p>
                      <p className="mt-1 text-[13px] text-[color:var(--admin-ink-2)]">{doseLabel(row)}</p>
                    </div>
                    <AdminBadge>{row.source_type || 'source'}</AdminBadge>
                  </div>
                  <p className="admin-muted mt-2 text-xs">
                    {row.source_label || 'Kein Quellenname'} {row.context_note ? `- ${row.context_note}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {statusChip('aktiv', row.is_active !== 0, 'green')}
                    {statusChip('default', row.is_default === 1, 'amber')}
                    {statusChip('public', row.is_public === 1)}
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
