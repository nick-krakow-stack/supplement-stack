import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Plus, RefreshCw, Search, Save, Trash2 } from 'lucide-react';
import {
  createIngredientPartLink,
  deleteIngredientPartLink,
  getAllIngredients,
  getIngredientParts,
  searchIngredientParts,
  searchIngredients,
  updateIngredientPartLink,
  type AdminIngredientPart,
  type AdminIngredientPartLink,
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
  }, [loadIngredients]);

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
      setActionError('Bitte einen Wirkstoff auswaehlen.');
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
      setActionError('Bitte zuerst einen Wirkstoff auswaehlen.');
      return;
    }
    const sort = Number(sortOrder);
    if (!Number.isInteger(sort)) {
      setActionError('Die Reihenfolge muss eine ganze Zahl sein.');
      return;
    }
    if (!selectedPartId && !partQuery.trim()) {
      setActionError('Bitte einen Wirkstoffteil auswaehlen oder neu eingeben.');
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
      setStatusMessage('Wirkstoffteil verknuepft.');
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
      setStatusMessage('Wirkstoffteil gespeichert.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartLink = async (part: AdminIngredientPartLink) => {
    if (!selectedIngredientId) return;
    const confirmed = window.confirm(`Wirkstoffteil "${part.part_name}" wirklich entfernen?`);
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
      setStatusMessage('Wirkstoffteil entfernt.');
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDeletingPartId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Wirkstoffteile"
        subtitle="Parts einem Wirkstoff zuordnen, ohne separate Wirkstoff-Datensaetze anzulegen."
        meta={<AdminBadge tone="info">{partLinks.length} Verknuepfungen</AdminBadge>}
      />

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
            Auswaehlen
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
        title="Neue Part-Verknuepfung"
        subtitle={selectedIngredient ? `Ziel-Wirkstoff: ${selectedIngredient.name}` : 'Zuerst einen Wirkstoff auswaehlen.'}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <label className="text-xs font-medium">
            Wirkstoffteil suchen oder neu eingeben
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
        title="Verknuepfte Wirkstoffteile"
        subtitle={selectedIngredient ? `${filteredPartLinks.length} Treffer fuer ${selectedIngredient.name}` : 'Kein Wirkstoff ausgewaehlt'}
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
          <AdminEmpty>Wirkstoff auswaehlen, um seine Wirkstoffteile zu pflegen.</AdminEmpty>
        ) : loadingParts ? (
          <AdminEmpty>
            <Loader2 size={14} className="mr-2 inline animate-spin" />
            Lade Wirkstoffteile...
          </AdminEmpty>
        ) : filteredPartLinks.length === 0 ? (
          <AdminEmpty>Keine Wirkstoffteile gefunden.</AdminEmpty>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Wirkstoffteil</th>
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
