import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  deleteIngredientSubIngredient,
  getAllIngredients,
  getIngredientSubIngredients,
  searchIngredients,
  upsertIngredientSubIngredient,
  type AdminIngredientSubIngredient,
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

  if (error instanceof Error) {
    return error.message;
  }

  return 'Die Anfrage ist fehlgeschlagen.';
}

function ingredientLabel(ingredient: IngredientLookup): string {
  return `${ingredient.name} (ID ${ingredient.id})`;
}

function parseIngredientId(value: string, candidates: IngredientLookup[]): number | null {
  const trimmed = value.trim();
  const labelMatch = /\\(ID\\s*(\\d+)\\)\\s*$/i.exec(trimmed);
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

function sortMappings(rows: AdminIngredientSubIngredient[]): AdminIngredientSubIngredient[] {
  return [...rows].sort((left, right) => {
    if (left.parent_name !== right.parent_name) return left.parent_name.localeCompare(right.parent_name);
    if (left.parent_ingredient_id !== right.parent_ingredient_id) return left.parent_ingredient_id - right.parent_ingredient_id;
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    return left.child_name.localeCompare(right.child_name);
  });
}

export default function AdministratorSubIngredientsPage() {
  const [mappings, setMappings] = useState<AdminIngredientSubIngredient[]>([]);
  const [ingredients, setIngredients] = useState<IngredientLookup[]>([]);
  const [parentFilter, setParentFilter] = useState('');
  const [childFilter, setChildFilter] = useState('');

  const [parentQuery, setParentQuery] = useState('');
  const [childQuery, setChildQuery] = useState('');
  const [promptLabel, setPromptLabel] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(false);

  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  const [loadingMappings, setLoadingMappings] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [savingMapping, setSavingMapping] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');
  const [fetchingParent, setFetchingParent] = useState(false);
  const [fetchingChild, setFetchingChild] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [ingredientLoadError, setIngredientLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [parentSuggestions, setParentSuggestions] = useState<IngredientLookup[]>([]);
  const [childSuggestions, setChildSuggestions] = useState<IngredientLookup[]>([]);

  const parentQueryIdRef = useRef(0);
  const childQueryIdRef = useRef(0);

  const ingredientById = useMemo(() => {
    const map = new Map<number, string>();
    ingredients.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [ingredients]);

  const parentFilterCandidates = useMemo(() => {
    const trimmed = parentFilter.trim().toLowerCase();
    if (!trimmed) return mappings;
    return mappings.filter((entry) => entry.parent_name.toLowerCase().includes(trimmed));
  }, [mappings, parentFilter]);

  const filteredMappings = useMemo(() => {
    const trimmedUntergeordnet = childFilter.trim().toLowerCase();
    if (!trimmedUntergeordnet) return parentFilterCandidates;
    return parentFilterCandidates.filter((entry) => entry.child_name.toLowerCase().includes(trimmedUntergeordnet));
  }, [childFilter, parentFilterCandidates]);

  const parentSuggestionsList = useMemo(() => {
    const fallback = ingredients.slice(0, 12);
    if (parentSuggestions.length > 0) return parentSuggestions;
    if (parentQuery.trim().length < 2) return fallback;
    return ingredients
      .filter((ingredient) =>
        ingredient.name.toLowerCase().includes(parentQuery.trim().toLowerCase()),
      )
      .slice(0, 12);
  }, [ingredients, parentQuery, parentSuggestions]);

  const childSuggestionsList = useMemo(() => {
    const fallback = ingredients.slice(0, 12);
    if (childSuggestions.length > 0) return childSuggestions;
    if (childQuery.trim().length < 2) return fallback;
    return ingredients
      .filter((ingredient) =>
        ingredient.name.toLowerCase().includes(childQuery.trim().toLowerCase()),
      )
      .slice(0, 12);
  }, [childQuery, childSuggestions, ingredients]);

  const loadMappings = useCallback(async () => {
    setLoadingMappings(true);
    setLoadError('');
    try {
      const rows = await getIngredientSubIngredients();
      setMappings(sortMappings(rows));
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setMappings([]);
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  const loadIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    setIngredientLoadError('');
    try {
      const rows = await getAllIngredients();
      setIngredients(rows);
    } catch (error) {
      setIngredientLoadError(getErrorMessage(error));
      setIngredients([]);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadIngredients();
  }, [loadMappings, loadIngredients]);

  useEffect(() => {
    const requestId = ++parentQueryIdRef.current;
    const trimmed = parentQuery.trim();
    if (trimmed.length < 2) {
      setParentSuggestions([]);
      setFetchingParent(false);
      return;
    }

    setFetchingParent(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchIngredients(trimmed);
        if (requestId === parentQueryIdRef.current) {
          setParentSuggestions(rows);
        }
      } catch {
        if (requestId === parentQueryIdRef.current) setParentSuggestions([]);
      } finally {
        if (requestId === parentQueryIdRef.current) setFetchingParent(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [parentQuery]);

  useEffect(() => {
    const requestId = ++childQueryIdRef.current;
    const trimmed = childQuery.trim();
    if (trimmed.length < 2) {
      setChildSuggestions([]);
      setFetchingChild(false);
      return;
    }

    setFetchingChild(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchIngredients(trimmed);
        if (requestId === childQueryIdRef.current) {
          setChildSuggestions(rows);
        }
      } catch {
        if (requestId === childQueryIdRef.current) setChildSuggestions([]);
      } finally {
        if (requestId === childQueryIdRef.current) setFetchingChild(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [childQuery]);

  const clearCreateForm = useCallback(() => {
    setParentQuery('');
    setChildQuery('');
    setSelectedParentId(null);
    setSelectedChildId(null);
    setPromptLabel('');
    setSortOrder('0');
    setIsDefaultPrompt(false);
    setStatusMessage('');
  }, []);

  const ensureIngredientId = (value: string, selected: number | null): number | null => {
    if (selected !== null && selected > 0) return selected;
    return parseIngredientId(value, ingredients);
  };

  const handleCreateMapping = async () => {
    setActionError('');
    setStatusMessage('');

    const parentId = ensureIngredientId(parentQuery, selectedParentId);
    const childId = ensureIngredientId(childQuery, selectedChildId);
    if (!parentId || parentId <= 0) {
      setActionError('Bitte einen übergeordneten Wirkstoff auswählen.');
      return;
    }
    if (!childId || childId <= 0) {
      setActionError('Bitte einen untergeordneten Wirkstoff auswählen.');
      return;
    }
    if (parentId === childId) {
      setActionError('Die beiden Wirkstoffe müssen unterschiedlich sein.');
      return;
    }

    const sort = Number(sortOrder);
    if (!Number.isFinite(sort)) {
      setActionError('Die Reihenfolge muss eine Zahl sein.');
      return;
    }

    setSavingMapping(true);
    try {
      const created = await upsertIngredientSubIngredient({
        parent_ingredient_id: parentId,
        child_ingredient_id: childId,
        sort_order: sort,
        prompt_label: promptLabel.trim() || null,
        is_default_prompt: isDefaultPrompt ? 1 : 0,
      });

      setMappings((previous) => {
        const index = previous.findIndex(
          (entry) =>
            entry.parent_ingredient_id === parentId && entry.child_ingredient_id === childId,
        );
        if (index >= 0) {
          const next = [...previous];
          next[index] = created;
          return sortMappings(next);
        }
        return sortMappings([...previous, created]);
      });

      setStatusMessage(
        `Zuordnung ${ingredientById.get(parentId) ?? `ID ${parentId}`} -> ${ingredientById.get(childId) ?? `ID ${childId}`} gespeichert.`,
      );
      clearCreateForm();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (entry: AdminIngredientSubIngredient) => {
    const confirmed = window.confirm(`Zuordnung "${entry.parent_name}" -> "${entry.child_name}" wirklich l\u00f6schen?`);
    if (!confirmed) return;

    const deleting = `${entry.parent_ingredient_id}:${entry.child_ingredient_id}`;
    setDeletingKey(deleting);
    setActionError('');
    setStatusMessage('');

    try {
      await deleteIngredientSubIngredient(entry.parent_ingredient_id, entry.child_ingredient_id);
      setMappings((previous) =>
        previous.filter(
          (current) =>
            !(
              current.parent_ingredient_id === entry.parent_ingredient_id &&
              current.child_ingredient_id === entry.child_ingredient_id
            ),
        ),
      );
      setStatusMessage(`Zuordnung ${entry.parent_name} -> ${entry.child_name} gel\u00f6scht.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDeletingKey('');
    }
  };

  const selectParentIngredient = (ingredient: IngredientLookup) => {
    setSelectedParentId(ingredient.id);
    setParentQuery(ingredientLabel(ingredient));
    setParentSuggestions([]);
  };

  const selectChildIngredient = (ingredient: IngredientLookup) => {
    setSelectedChildId(ingredient.id);
    setChildQuery(ingredientLabel(ingredient));
    setChildSuggestions([]);
  };

  return (
    <>
      <AdminPageHeader
        title="Wirkstoff-Beziehungen"
        subtitle="Pflegt Beziehungen zwischen übergeordneten und untergeordneten Wirkstoffen."
        meta={<AdminBadge tone="info">{mappings.length} Zuordnungen</AdminBadge>}
      />

      <section className="admin-toolbar">
        <div className="admin-toolbar-inline">
          <label className="admin-input inline-flex min-h-[38px] items-center gap-2">
            <Search size={14} className="admin-muted" />
            <input
              value={parentFilter}
              onChange={(event) => setParentFilter(event.target.value)}
              placeholder="Übergeordneter Wirkstoff"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
          <label className="admin-input inline-flex min-h-[38px] items-center gap-2">
            <Search size={14} className="admin-muted" />
            <input
              value={childFilter}
              onChange={(event) => setChildFilter(event.target.value)}
              placeholder="Untergeordneter Wirkstoff"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
          <AdminButton onClick={() => void loadMappings()}>
            <RefreshCw size={14} />
            Zuordnungen aktualisieren
          </AdminButton>
        </div>
      </section>

      <AdminCard title="Neue Zuordnung" subtitle={'Zwei Wirkstoffe per Suche ausw\u00e4hlen und als Beziehung speichern.'}>
        <div className="admin-card-pad">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Übergeordneter Wirkstoff</label>
              <input
                value={parentQuery}
                onChange={(event) => {
                  setSelectedParentId(null);
                  setParentQuery(event.target.value);
                }}
                placeholder="z. B. Magnesium"
                className="admin-input"
              />
              {fetchingParent ? <div className="admin-muted text-xs">Suche...</div> : null}
              {parentSuggestionsList.length > 0 ? (
                <div className="admin-table-wrap max-h-40 overflow-y-auto rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)]">
                  <div className="space-y-0.5 p-1">
                    {parentSuggestionsList.map((ingredient) => (
                      <button
                        key={`parent-${ingredient.id}`}
                        type="button"
                        className="w-full rounded-[var(--admin-r-sm)] px-2 py-2 text-left text-xs hover:bg-[color:var(--admin-bg-sunk)]"
                        onClick={() => selectParentIngredient(ingredient)}
                      >
                        {ingredientLabel(ingredient)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Untergeordneter Wirkstoff</label>
              <input
                value={childQuery}
                onChange={(event) => {
                  setSelectedChildId(null);
                  setChildQuery(event.target.value);
                }}
                placeholder="z. B. Calcium"
                className="admin-input"
              />
              {fetchingChild ? <div className="admin-muted text-xs">Suche...</div> : null}
              {childSuggestionsList.length > 0 ? (
                <div className="admin-table-wrap max-h-40 overflow-y-auto rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)]">
                  <div className="space-y-0.5 p-1">
                    {childSuggestionsList.map((ingredient) => (
                      <button
                        key={`child-${ingredient.id}`}
                        type="button"
                        className="w-full rounded-[var(--admin-r-sm)] px-2 py-2 text-left text-xs hover:bg-[color:var(--admin-bg-sunk)]"
                        onClick={() => selectChildIngredient(ingredient)}
                      >
                        {ingredientLabel(ingredient)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <label className="space-y-2 text-xs font-medium">
              Hinweistext
              <input
                value={promptLabel}
                onChange={(event) => setPromptLabel(event.target.value)}
                placeholder="z. B. weitere Wirkstoffform"
                className="admin-input mt-1"
              />
            </label>

            <label className="space-y-2 text-xs font-medium">
              Reihenfolge
              <input
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="admin-input mt-1"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={isDefaultPrompt}
                onChange={(event) => setIsDefaultPrompt(event.target.checked)}
              />
              Standardhinweis
            </label>

            <div className="flex items-end gap-2">
              <AdminButton
                onClick={() => void handleCreateMapping()}
                disabled={savingMapping || loadingIngredients}
                variant="primary"
              >
                {savingMapping ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Zuordnung speichern
              </AdminButton>
              <AdminButton onClick={clearCreateForm} disabled={savingMapping} variant="ghost">
                Zurücksetzen
              </AdminButton>
            </div>
          </div>

          {statusMessage ? (
            <div className="mt-3">
              <div className="inline-flex items-center gap-2 rounded-[var(--admin-r-sm)] bg-[color:var(--admin-success-soft)] px-2.5 py-1.5 text-xs text-[color:var(--admin-success-ink)]">
                <span>Info:</span>
                <span>{statusMessage}</span>
              </div>
            </div>
          ) : null}
        </div>
      </AdminCard>

      {loadError ? <AdminError>{loadError}</AdminError> : null}
      {ingredientLoadError ? <AdminError>{ingredientLoadError}</AdminError> : null}
      {actionError ? (
        <AdminError>
          <AlertCircle size={14} />
          {actionError}
        </AdminError>
      ) : null}

      <AdminCard
        title="Bestehende Zuordnungen"
        subtitle={`${filteredMappings.length} Treffer`}
      >
        {loadingMappings ? (
          <AdminEmpty>
            <Loader2 size={14} className="mr-2 inline animate-spin" />
            Lade Zuordnungen...
          </AdminEmpty>
        ) : filteredMappings.length === 0 ? (
          <AdminEmpty>Keine Zuordnungen gefunden.</AdminEmpty>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Übergeordnet</th>
                  <th>Untergeordnet</th>
                  <th>Hinweistext</th>
                  <th>Reihenfolge</th>
                  <th>Standard</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.map((entry) => {
                  const key = `${entry.parent_ingredient_id}:${entry.child_ingredient_id}`;
                  const isDeleting = deletingKey === key;
                  return (
                    <tr key={key}>
                      <td>
                        <div className="font-medium">
                          {entry.parent_name} ({entry.parent_ingredient_id})
                        </div>
                      </td>
                      <td>
                        <div className="font-medium">
                          {entry.child_name} ({entry.child_ingredient_id})
                        </div>
                      </td>
                      <td className="admin-muted">{entry.prompt_label || '-'}</td>
                      <td>
                        <AdminBadge>{entry.sort_order}</AdminBadge>
                      </td>
                      <td>
                        {entry.is_default_prompt ? (
                          <AdminBadge tone="ok">Ja</AdminBadge>
                        ) : (
                          <AdminBadge tone="neutral">Nein</AdminBadge>
                        )}
                      </td>
                      <td>
                        <AdminButton
                          size="sm"
                          variant="danger"
                          onClick={() => void handleDeleteMapping(entry)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Löschen
                        </AdminButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {loadingIngredients ? <AdminEmpty>Lade Ingredients...</AdminEmpty> : null}
    </>
  );
}
