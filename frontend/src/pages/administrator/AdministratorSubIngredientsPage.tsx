import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Edit3, Loader2, Plus, RefreshCw, Search, Save, Trash2, X } from 'lucide-react';
import {
  createIngredientPart,
  createIngredientPartLink,
  createIngredientPartSynonym,
  deleteIngredientPart,
  deleteIngredientPartLink,
  deleteIngredientPartSynonym,
  getAllIngredients,
  getIngredientParts,
  searchIngredientParts,
  searchIngredients,
  updateIngredientPart,
  updateIngredientPartLink,
  updateIngredientPartSynonym,
  type AdminIngredientPart,
  type AdminIngredientPartLink,
  type AdminIngredientPartStatus,
  type AdminIngredientPartSynonym,
  type IngredientLookup,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

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

function ingredientLabel(ingredient: IngredientLookup): string {
  return `${ingredient.name} (ID ${ingredient.id})`;
}

function parseIngredientId(value: string, candidates: IngredientLookup[]): number | null {
  const trimmed = value.trim();
  const labelMatch = /\(ID\s*(\d+)\)\s*$/i.exec(trimmed);
  if (labelMatch) {
    const parsed = Number(labelMatch[1]);
    if (Number.isInteger(parsed)) return parsed;
  }

  const exactId = Number(trimmed);
  if (Number.isInteger(exactId) && exactId > 0) return exactId;

  const normalized = trimmed.toLowerCase();
  const match = candidates.find((item) => item.name.toLowerCase() === normalized);
  return match ? match.id : null;
}

function sortPartLinks(rows: AdminIngredientPartLink[]): AdminIngredientPartLink[] {
  return [...rows].sort((left, right) => {
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    return left.part_name.localeCompare(right.part_name, 'de');
  });
}

export default function AdministratorSubIngredientsPage() {
  const [masterParts, setMasterParts] = useState<AdminIngredientPart[]>([]);
  const [masterQuery, setMasterQuery] = useState('');
  const [masterStatus, setMasterStatus] = useState<'' | AdminIngredientPartStatus>('');
  const [editingPartId, setEditingPartId] = useState<number | 'new' | null>(null);
  const [masterDraft, setMasterDraft] = useState({ name: '', type: '', status: 'active' as AdminIngredientPartStatus, internal_comment: '' });
  const [synonymDrafts, setSynonymDrafts] = useState<Record<number, { synonym: string; language: string }>>({});
  const [newSynonym, setNewSynonym] = useState({ synonym: '', language: 'de' });
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [savingMaster, setSavingMaster] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientLookup[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientSuggestions, setIngredientSuggestions] = useState<IngredientLookup[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [partLinks, setPartLinks] = useState<AdminIngredientPartLink[]>([]);
  const [partDrafts, setPartDrafts] = useState<Record<number, string>>({});
  const [partFilter, setPartFilter] = useState('');

  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<AdminIngredientPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState('0');

  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [loadingParts, setLoadingParts] = useState(false);
  const [saving, setSaving] = useState<false | 'new' | number>(false);
  const [deletingPartId, setDeletingPartId] = useState<number | null>(null);
  const [fetchingIngredient, setFetchingIngredient] = useState(false);
  const [fetchingParts, setFetchingParts] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const ingredientQueryIdRef = useRef(0);
  const selectedIngredient = ingredients.find((ingredient) => ingredient.id === selectedIngredientId) ?? null;

  const filteredPartLinks = useMemo(() => {
    const query = partFilter.trim().toLowerCase();
    if (!query) return partLinks;
    return partLinks.filter((part) => part.part_name.toLowerCase().includes(query));
  }, [partFilter, partLinks]);

  const ingredientSuggestionList = useMemo(() => {
    if (ingredientSuggestions.length > 0) return ingredientSuggestions;
    const query = ingredientQuery.trim().toLowerCase();
    if (query.length < 2) return ingredients.slice(0, 12);
    return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(query)).slice(0, 12);
  }, [ingredientQuery, ingredientSuggestions, ingredients]);

  const loadIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    setLoadError('');
    try {
      setIngredients(await getAllIngredients());
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setIngredients([]);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  const loadMasterParts = useCallback(async (query: string, status: '' | AdminIngredientPartStatus) => {
    setLoadingMaster(true);
    setLoadError('');
    try {
      setMasterParts(await searchIngredientParts(query, 100, status || undefined));
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoadingMaster(false);
    }
  }, []);

  const loadPartsForIngredient = useCallback(async (ingredientId: number | null) => {
    if (!ingredientId) {
      setPartLinks([]);
      setPartDrafts({});
      return;
    }
    setLoadingParts(true);
    setLoadError('');
    try {
      const rows = sortPartLinks(await getIngredientParts(ingredientId));
      setPartLinks(rows);
      setPartDrafts(Object.fromEntries(rows.map((part) => [part.part_id, String(part.sort_order ?? 0)])));
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setPartLinks([]);
      setPartDrafts({});
    } finally {
      setLoadingParts(false);
    }
  }, []);

  useEffect(() => {
    void loadIngredients();
    void loadMasterParts('', '');
  }, [loadIngredients, loadMasterParts]);

  useEffect(() => {
    void loadPartsForIngredient(selectedIngredientId);
  }, [loadPartsForIngredient, selectedIngredientId]);

  useEffect(() => {
    const requestId = ++ingredientQueryIdRef.current;
    const trimmed = ingredientQuery.trim();
    if (trimmed.length < 2) {
      setIngredientSuggestions([]);
      setFetchingIngredient(false);
      return;
    }

    setFetchingIngredient(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchIngredients(trimmed);
        if (requestId === ingredientQueryIdRef.current) setIngredientSuggestions(rows);
      } catch {
        if (requestId === ingredientQueryIdRef.current) setIngredientSuggestions([]);
      } finally {
        if (requestId === ingredientQueryIdRef.current) setFetchingIngredient(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [ingredientQuery]);

  const selectIngredient = (ingredient: IngredientLookup) => {
    setSelectedIngredientId(ingredient.id);
    setIngredientQuery(ingredientLabel(ingredient));
    setIngredientSuggestions([]);
    setStatusMessage('');
    setActionError('');
  };

  const selectIngredientFromInput = () => {
    const ingredientId = parseIngredientId(ingredientQuery, ingredients);
    if (!ingredientId) {
      setActionError('Bitte einen Wirkstoff auswählen.');
      return;
    }
    setSelectedIngredientId(ingredientId);
    setActionError('');
  };

  const handleSearchParts = async () => {
    const query = partQuery.trim();
    setSelectedPartId(null);
    setStatusMessage('');
    if (!query) {
      setPartResults([]);
      return;
    }
    setFetchingParts(true);
    setActionError('');
    try {
      setPartResults(await searchIngredientParts(query, 12));
    } catch (error) {
      setActionError(getErrorMessage(error));
      setPartResults([]);
    } finally {
      setFetchingParts(false);
    }
  };

  const handleCreatePartLink = async () => {
    if (!selectedIngredientId) {
      setActionError('Bitte zuerst einen Wirkstoff auswählen.');
      return;
    }
    const sort = Number(sortOrder);
    if (!Number.isInteger(sort)) {
      setActionError('Die Reihenfolge muss eine ganze Zahl sein.');
      return;
    }
    if (!selectedPartId && !partQuery.trim()) {
      setActionError('Bitte einen Sub-Wirkstoff auswählen oder neu eingeben.');
      return;
    }

    setSaving('new');
    setActionError('');
    setStatusMessage('');
    try {
      const created = await createIngredientPartLink(selectedIngredientId, {
        part_id: selectedPartId,
        part_name: selectedPartId ? null : partQuery.trim(),
        sort_order: sort,
      });
      setPartLinks((previous) => sortPartLinks([
        ...previous.filter((part) => part.part_id !== created.part_id),
        created,
      ]));
      setPartDrafts((previous) => ({ ...previous, [created.part_id]: String(created.sort_order ?? 0) }));
      setSelectedPartId(null);
      setPartQuery('');
      setPartResults([]);
      setSortOrder('0');
      setStatusMessage('Sub-Wirkstoff verknüpft.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePartLink = async (part: AdminIngredientPartLink) => {
    if (!selectedIngredientId) return;
    const sort = Number(partDrafts[part.part_id] ?? part.sort_order ?? 0);
    if (!Number.isInteger(sort)) {
      setActionError('Die Reihenfolge muss eine ganze Zahl sein.');
      return;
    }
    setSaving(part.part_id);
    setActionError('');
    setStatusMessage('');
    try {
      const updated = await updateIngredientPartLink(selectedIngredientId, part.part_id, { sort_order: sort });
      setPartLinks((previous) => sortPartLinks(previous.map((entry) => (entry.part_id === updated.part_id ? updated : entry))));
      setPartDrafts((previous) => ({ ...previous, [updated.part_id]: String(updated.sort_order ?? 0) }));
      setStatusMessage('Sub-Wirkstoff gespeichert.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartLink = async (part: AdminIngredientPartLink) => {
    if (!selectedIngredientId) return;
    const confirmed = window.confirm(`Sub-Wirkstoff "${part.part_name}" wirklich entfernen?`);
    if (!confirmed) return;

    setDeletingPartId(part.part_id);
    setActionError('');
    setStatusMessage('');
    try {
      await deleteIngredientPartLink(selectedIngredientId, part.part_id);
      setPartLinks((previous) => previous.filter((entry) => entry.part_id !== part.part_id));
      setPartDrafts((previous) => {
        const next = { ...previous };
        delete next[part.part_id];
        return next;
      });
      setStatusMessage('Sub-Wirkstoff entfernt.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDeletingPartId(null);
    }
  };

  const beginCreateMasterPart = () => {
    setEditingPartId('new');
    setMasterDraft({ name: '', type: '', status: 'active', internal_comment: '' });
    setSynonymDrafts({});
    setNewSynonym({ synonym: '', language: 'de' });
    setActionError('');
  };

  const beginEditMasterPart = (part: AdminIngredientPart) => {
    setEditingPartId(part.id);
    setMasterDraft({
      name: part.name,
      type: part.type ?? '',
      status: part.status === 'inactive' || part.status === 'deprecated' ? part.status : 'active',
      internal_comment: part.internal_comment ?? '',
    });
    setSynonymDrafts(Object.fromEntries(part.synonyms.map((synonym) => [synonym.id, {
      synonym: synonym.synonym,
      language: synonym.language,
    }])));
    setNewSynonym({ synonym: '', language: 'de' });
    setActionError('');
  };

  const handleSaveMasterPart = async () => {
    const name = masterDraft.name.trim();
    if (!name) {
      setActionError('Bitte einen Namen für den Sub-Wirkstoff eingeben.');
      return;
    }
    setSavingMaster(true);
    setActionError('');
    try {
      const payload = {
        name,
        type: masterDraft.type.trim() || null,
        status: masterDraft.status,
        internal_comment: masterDraft.internal_comment.trim() || null,
      };
      if (editingPartId === 'new') {
        await createIngredientPart(payload);
        setStatusMessage('Sub-Wirkstoff angelegt.');
      } else if (typeof editingPartId === 'number') {
        await updateIngredientPart(editingPartId, payload);
        setStatusMessage('Sub-Wirkstoff gespeichert.');
      }
      setEditingPartId(null);
      await Promise.all([
        loadMasterParts(masterQuery, masterStatus),
        loadPartsForIngredient(selectedIngredientId),
      ]);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingMaster(false);
    }
  };

  const handleDeleteMasterPart = async (part: AdminIngredientPart) => {
    if (!window.confirm(`Sub-Wirkstoff "${part.name}" wirklich löschen? Verknüpfte Einträge können nicht gelöscht werden.`)) return;
    setSavingMaster(true);
    setActionError('');
    try {
      await deleteIngredientPart(part.id);
      if (editingPartId === part.id) setEditingPartId(null);
      await loadMasterParts(masterQuery, masterStatus);
      setStatusMessage('Sub-Wirkstoff gelöscht.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingMaster(false);
    }
  };

  const handleSaveSynonym = async (synonym: AdminIngredientPartSynonym) => {
    const draft = synonymDrafts[synonym.id];
    if (!draft?.synonym.trim()) {
      setActionError('Das Synonym darf nicht leer sein.');
      return;
    }
    setSavingMaster(true);
    try {
      await updateIngredientPartSynonym(synonym.id, {
        synonym: draft.synonym.trim(),
        language: draft.language.trim() || 'de',
      });
      await loadMasterParts(masterQuery, masterStatus);
      setStatusMessage('Synonym gespeichert.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingMaster(false);
    }
  };

  const handleAddSynonym = async (partId: number) => {
    if (!newSynonym.synonym.trim()) {
      setActionError('Bitte ein Synonym eingeben.');
      return;
    }
    setSavingMaster(true);
    try {
      await createIngredientPartSynonym(partId, {
        synonym: newSynonym.synonym.trim(),
        language: newSynonym.language.trim() || 'de',
      });
      setNewSynonym({ synonym: '', language: 'de' });
      await loadMasterParts(masterQuery, masterStatus);
      setStatusMessage('Synonym hinzugefügt.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingMaster(false);
    }
  };

  const handleDeleteSynonym = async (synonymId: number) => {
    setSavingMaster(true);
    try {
      await deleteIngredientPartSynonym(synonymId);
      await loadMasterParts(masterQuery, masterStatus);
      setStatusMessage('Synonym entfernt.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingMaster(false);
    }
  };

  const editingMasterPart = typeof editingPartId === 'number'
    ? masterParts.find((part) => part.id === editingPartId) ?? null
    : null;

  return (
    <>
      <AdminPageHeader
        title="Sub-Wirkstoffe"
        subtitle="Sub-Wirkstoffe vollständig pflegen und Hauptwirkstoffen eindeutig zuordnen."
        meta={<AdminBadge tone="info">{partLinks.length} Verknüpfungen</AdminBadge>}
      />

      <AdminCard
        title="Sub-Wirkstoff-Stammdaten"
        subtitle="Name, Typ, Status, interne Hinweise und sprachgebundene Synonyme."
        actions={<AdminButton variant="primary" onClick={beginCreateMasterPart}><Plus size={14} /> Neu</AdminButton>}
      >
        <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <label className="text-xs font-medium">
            Stammdaten durchsuchen
            <input value={masterQuery} onChange={(event) => setMasterQuery(event.target.value)} className="admin-input mt-1" placeholder="Name oder Synonym" />
          </label>
          <label className="text-xs font-medium">
            Status
            <select value={masterStatus} onChange={(event) => setMasterStatus(event.target.value as '' | AdminIngredientPartStatus)} className="admin-select mt-1">
              <option value="">alle</option>
              <option value="active">aktiv</option>
              <option value="inactive">inaktiv</option>
              <option value="deprecated">veraltet</option>
            </select>
          </label>
          <div className="flex items-end">
            <AdminButton onClick={() => void loadMasterParts(masterQuery, masterStatus)} disabled={loadingMaster}>
              {loadingMaster ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Suchen
            </AdminButton>
          </div>
        </div>

        {editingPartId !== null && (
          <div className="mb-4 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium">Name
                <input value={masterDraft.name} onChange={(event) => setMasterDraft((draft) => ({ ...draft, name: event.target.value }))} className="admin-input mt-1" />
              </label>
              <label className="text-xs font-medium">Typ
                <input value={masterDraft.type} onChange={(event) => setMasterDraft((draft) => ({ ...draft, type: event.target.value }))} className="admin-input mt-1" placeholder="z. B. Fettsäure" />
              </label>
              <label className="text-xs font-medium">Status
                <select value={masterDraft.status} onChange={(event) => setMasterDraft((draft) => ({ ...draft, status: event.target.value as AdminIngredientPartStatus }))} className="admin-select mt-1">
                  <option value="active">aktiv</option>
                  <option value="inactive">inaktiv</option>
                  <option value="deprecated">veraltet</option>
                </select>
              </label>
              <label className="text-xs font-medium">Interner Hinweis
                <textarea value={masterDraft.internal_comment} onChange={(event) => setMasterDraft((draft) => ({ ...draft, internal_comment: event.target.value }))} className="admin-input mt-1" rows={2} />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <AdminButton variant="ghost" onClick={() => setEditingPartId(null)} disabled={savingMaster}><X size={14} /> Abbrechen</AdminButton>
              <AdminButton variant="primary" onClick={() => void handleSaveMasterPart()} disabled={savingMaster}><Save size={14} /> Speichern</AdminButton>
            </div>

            {editingMasterPart && (
              <div className="mt-4 border-t border-[color:var(--admin-line)] pt-3">
                <h3 className="text-sm font-semibold">Synonyme</h3>
                <div className="mt-2 grid gap-2">
                  {editingMasterPart.synonyms.map((synonym) => {
                    const draft = synonymDrafts[synonym.id] ?? { synonym: synonym.synonym, language: synonym.language };
                    return (
                      <div key={synonym.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
                        <input value={draft.synonym} onChange={(event) => setSynonymDrafts((rows) => ({ ...rows, [synonym.id]: { ...draft, synonym: event.target.value } }))} className="admin-input" aria-label={`Synonym ${synonym.synonym}`} />
                        <input value={draft.language} onChange={(event) => setSynonymDrafts((rows) => ({ ...rows, [synonym.id]: { ...draft, language: event.target.value } }))} className="admin-input" aria-label={`Sprache ${synonym.synonym}`} />
                        <div className="flex gap-1">
                          <AdminButton size="sm" onClick={() => void handleSaveSynonym(synonym)} disabled={savingMaster}><Save size={13} /></AdminButton>
                          <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteSynonym(synonym.id)} disabled={savingMaster}><Trash2 size={13} /></AdminButton>
                        </div>
                      </div>
                    );
                  })}
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
                    <input value={newSynonym.synonym} onChange={(event) => setNewSynonym((draft) => ({ ...draft, synonym: event.target.value }))} className="admin-input" placeholder="Neues Synonym" />
                    <input value={newSynonym.language} onChange={(event) => setNewSynonym((draft) => ({ ...draft, language: event.target.value }))} className="admin-input" placeholder="de" />
                    <AdminButton size="sm" onClick={() => void handleAddSynonym(editingMasterPart.id)} disabled={savingMaster || !newSynonym.synonym.trim()}><Plus size={13} /> Hinzufügen</AdminButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {loadingMaster ? <AdminEmpty>Lade Sub-Wirkstoffe...</AdminEmpty> : masterParts.length === 0 ? <AdminEmpty>Keine Sub-Wirkstoffe gefunden.</AdminEmpty> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Typ</th><th>Status</th><th>Synonyme</th><th>Aktionen</th></tr></thead>
              <tbody>{masterParts.map((part) => (
                <tr key={part.id}>
                  <td><div className="font-medium">{part.name}</div><div className="admin-muted text-xs">ID {part.id}</div></td>
                  <td>{part.type || '-'}</td>
                  <td><AdminBadge tone={part.status === 'active' ? 'ok' : part.status === 'deprecated' ? 'warn' : 'neutral'}>{part.status === 'active' ? 'aktiv' : part.status === 'deprecated' ? 'veraltet' : 'inaktiv'}</AdminBadge></td>
                  <td className="max-w-[280px] text-xs">{part.synonyms.map((synonym) => `${synonym.synonym} (${synonym.language})`).join(', ') || '-'}</td>
                  <td><div className="flex gap-2">
                    <AdminButton size="sm" variant="ghost" onClick={() => beginEditMasterPart(part)}><Edit3 size={13} /> Bearbeiten</AdminButton>
                    <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteMasterPart(part)} disabled={savingMaster}><Trash2 size={13} /> Löschen</AdminButton>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <section className="admin-toolbar">
        <div className="admin-toolbar-inline">
          <label className="admin-input inline-flex min-h-[38px] items-center gap-2">
            <Search size={14} className="admin-muted" />
            <input
              value={ingredientQuery}
              onChange={(event) => {
                setSelectedIngredientId(null);
                setIngredientQuery(event.target.value);
              }}
              placeholder="Wirkstoff suchen"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
          <AdminButton onClick={selectIngredientFromInput} disabled={loadingIngredients || !ingredientQuery.trim()}>
            Auswählen
          </AdminButton>
          <AdminButton onClick={() => void loadPartsForIngredient(selectedIngredientId)} disabled={!selectedIngredientId || loadingParts}>
            <RefreshCw size={14} className={loadingParts ? 'animate-spin' : ''} />
            Aktualisieren
          </AdminButton>
        </div>
      </section>

      {ingredientSuggestionList.length > 0 && !selectedIngredientId ? (
        <AdminCard title="Wirkstoff-Treffer">
          <div className="grid gap-1">
            {ingredientSuggestionList.map((ingredient) => (
              <button
                key={ingredient.id}
                type="button"
                className="rounded-[var(--admin-r-sm)] px-2 py-2 text-left text-sm hover:bg-[color:var(--admin-bg-sunk)]"
                onClick={() => selectIngredient(ingredient)}
              >
                {ingredientLabel(ingredient)}
              </button>
            ))}
          </div>
          {fetchingIngredient ? <p className="admin-muted mt-2 text-xs">Suche...</p> : null}
        </AdminCard>
      ) : null}

      <AdminCard
        title="Neue Sub-Wirkstoff-Verknüpfung"
        subtitle={selectedIngredient ? `Ziel-Wirkstoff: ${selectedIngredient.name}` : 'Zuerst einen Wirkstoff auswählen.'}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <label className="text-xs font-medium">
            Sub-Wirkstoff suchen oder neu eingeben
            <input
              value={partQuery}
              onChange={(event) => {
                setSelectedPartId(null);
                setPartQuery(event.target.value);
              }}
              placeholder="z. B. EPA"
              className="admin-input mt-1"
              disabled={!selectedIngredientId || saving !== false}
            />
          </label>
          <label className="text-xs font-medium">
            Reihenfolge
            <input
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="admin-input mt-1"
              disabled={!selectedIngredientId || saving !== false}
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <AdminButton onClick={() => void handleSearchParts()} disabled={!selectedIngredientId || !partQuery.trim() || fetchingParts}>
              {fetchingParts ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Suchen
            </AdminButton>
            <AdminButton
              onClick={() => void handleCreatePartLink()}
              disabled={!selectedIngredientId || saving !== false || (!selectedPartId && !partQuery.trim())}
              variant="primary"
            >
              {saving === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {selectedPartId ? 'Treffer verknuepfen' : 'Neu anlegen und verknuepfen'}
            </AdminButton>
          </div>
          {partResults.length > 0 ? (
            <div className="grid gap-1 md:col-span-2">
              {partResults.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className={`rounded-[var(--admin-r-sm)] px-2 py-2 text-left text-sm ${
                    selectedPartId === part.id ? 'bg-[color:var(--admin-primary-soft)]' : 'hover:bg-[color:var(--admin-bg-sunk)]'
                  }`}
                  onClick={() => {
                    setSelectedPartId(part.id);
                    setPartQuery(part.name);
                  }}
                >
                  <span className="font-medium">{part.name}</span>
                  <span className="admin-muted ml-2 text-xs">ID {part.id}{part.type ? ` - ${part.type}` : ''}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </AdminCard>

      {loadError ? <AdminError>{loadError}</AdminError> : null}
      {actionError ? (
        <AdminError>
          <AlertCircle size={14} />
          {actionError}
        </AdminError>
      ) : null}
      {statusMessage ? (
        <div className="rounded-[var(--admin-r-sm)] bg-[color:var(--admin-success-soft)] px-3 py-2 text-sm text-[color:var(--admin-success-ink)]">
          {statusMessage}
        </div>
      ) : null}

      <AdminCard
        title="Verknüpfte Sub-Wirkstoffe"
        subtitle={selectedIngredient ? `${filteredPartLinks.length} Treffer für ${selectedIngredient.name}` : 'Kein Wirkstoff ausgewählt'}
        actions={
          <label className="admin-input inline-flex min-h-[34px] items-center gap-2">
            <Search size={13} className="admin-muted" />
            <input
              value={partFilter}
              onChange={(event) => setPartFilter(event.target.value)}
              placeholder="Part filtern"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
        }
      >
        {!selectedIngredientId ? (
          <AdminEmpty>Wirkstoff auswählen, um seine Sub-Wirkstoffe zu pflegen.</AdminEmpty>
        ) : loadingParts ? (
          <AdminEmpty>
            <Loader2 size={14} className="mr-2 inline animate-spin" />
            Lade Sub-Wirkstoffe...
          </AdminEmpty>
        ) : filteredPartLinks.length === 0 ? (
          <AdminEmpty>Keine Sub-Wirkstoffe gefunden.</AdminEmpty>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sub-Wirkstoff</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Reihenfolge</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartLinks.map((part) => (
                  <tr key={part.part_id}>
                    <td>
                      <div className="font-medium">{part.part_name}</div>
                      <div className="admin-muted text-xs">ID {part.part_id}</div>
                    </td>
                    <td>{part.part_type || '-'}</td>
                    <td>{part.part_status ? <AdminBadge>{part.part_status}</AdminBadge> : '-'}</td>
                    <td>
                      <input
                        value={partDrafts[part.part_id] ?? String(part.sort_order ?? 0)}
                        onChange={(event) => setPartDrafts((previous) => ({ ...previous, [part.part_id]: event.target.value }))}
                        className="admin-input w-24"
                        inputMode="numeric"
                      />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          size="sm"
                          onClick={() => void handleUpdatePartLink(part)}
                          disabled={saving === part.part_id}
                        >
                          {saving === part.part_id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Speichern
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="danger"
                          onClick={() => void handleDeletePartLink(part)}
                          disabled={deletingPartId === part.part_id}
                        >
                          {deletingPartId === part.part_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Entfernen
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {loadingIngredients ? <AdminEmpty>Lade Wirkstoffe...</AdminEmpty> : null}
    </>
  );
}
