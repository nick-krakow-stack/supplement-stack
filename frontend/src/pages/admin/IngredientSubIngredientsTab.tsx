import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, Plus, Search, Trash2, XCircle } from 'lucide-react';
import {
  deleteIngredientSubIngredient,
  getAllIngredients,
  getIngredientSubIngredients,
  upsertIngredientSubIngredient,
  type AdminIngredientSubIngredient,
} from '../../api/admin';

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

interface IngredientOption {
  id: number;
  name: string;
  unit?: string | null;
}

function ingredientLabel(ingredient: IngredientOption): string {
  const unit = ingredient.unit ? ` (${ingredient.unit})` : '';
  return `${ingredient.name} (ID ${ingredient.id})${unit}`;
}

function formatIngredientOption(ingredient: IngredientOption): string {
  return `${ingredient.name} (ID ${ingredient.id})`;
}

function parseIngredientIdFromLabel(label: string, options: IngredientOption[]): number | null {
  const exact = options.find((option) => ingredientLabel(option) === label);
  if (exact) return exact.id;

  const numericMatch = label.match(/ID\\s+(\\d+)$/);
  if (!numericMatch) return null;
  const parsed = Number(numericMatch[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function pickIngredient(options: IngredientOption[], query: string): IngredientOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return options.slice(0, 10);
  }

  return options
    .filter((option) => `${option.name} ${option.id}`.toLowerCase().includes(trimmed))
    .slice(0, 12);
}

const DEFAULT_SORT_ORDER = '0';

export default function IngredientSubIngredientsTab() {
  const [mappings, setMappings] = useState<AdminIngredientSubIngredient[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [parentFilter, setParentFilter] = useState('');
  const [childFilter, setChildFilter] = useState('');

  const [parentQuery, setParentQuery] = useState('');
  const [childQuery, setChildQuery] = useState('');
  const [promptLabel, setPromptLabel] = useState('');
  const [sortOrder, setSortOrder] = useState(DEFAULT_SORT_ORDER);
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(false);

  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string>('');

  const parentSuggestions = useMemo(
    () => pickIngredient(ingredients, parentQuery),
    [ingredients, parentQuery],
  );

  const childSuggestions = useMemo(() => pickIngredient(ingredients, childQuery), [ingredients, childQuery]);

  const loadMappings = useCallback(async () => {
    setLoadingMappings(true);
    setLoadError('');

    try {
      const rows = await getIngredientSubIngredients();
      const sorted = [...rows].sort((left, right) => {
        if (left.parent_name !== right.parent_name) {
          return left.parent_name.localeCompare(right.parent_name);
        }

        if (left.parent_ingredient_id !== right.parent_ingredient_id) {
          return left.parent_ingredient_id - right.parent_ingredient_id;
        }

        return left.sort_order - right.sort_order;
      });

      setMappings(sorted);
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setMappings([]);
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  const loadIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    try {
      const rows = await getAllIngredients();
      setIngredients(rows);
    } catch (error) {
      setActionError(getErrorMessage(error));
      setIngredients([]);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadIngredients();
  }, [loadMappings, loadIngredients]);

  const filteredMappings = useMemo(() => {
    const parentQueryNormalized = parentFilter.trim().toLowerCase();
    const childQueryNormalized = childFilter.trim().toLowerCase();

    return mappings.filter((row) => {
      if (parentQueryNormalized && !row.parent_name.toLowerCase().includes(parentQueryNormalized)) {
        return false;
      }
      if (childQueryNormalized && !row.child_name.toLowerCase().includes(childQueryNormalized)) {
        return false;
      }
      return true;
    });
  }, [childFilter, mappings, parentFilter]);

  const createMapping = async () => {
    setActionError('');
    setSuccessMessage('');

    const parentId = parseIngredientIdFromLabel(parentQuery, ingredients);
    const childId = parseIngredientIdFromLabel(childQuery, ingredients);

    if (!parentId || parentId <= 0) {
      setActionError('Parent (Wirkstoff) ist ungültig oder nicht vorhanden. Bitte aus der Liste waehlen.');
      return;
    }

    if (!childId || childId <= 0) {
      setActionError('Child (Wirkstoff) ist ungültig oder nicht vorhanden. Bitte aus der Liste waehlen.');
      return;
    }

    if (parentId === childId) {
      setActionError('Parent und Child duerfen nicht identisch sein.');
      return;
    }

    const parsedSortOrder = Number(sortOrder);
    if (Number.isNaN(parsedSortOrder)) {
      setActionError('Sort Order muss eine Zahl sein.');
      return;
    }

    setCreating(true);
    try {
      const created = await upsertIngredientSubIngredient({
        parent_ingredient_id: parentId,
        child_ingredient_id: childId,
        sort_order: parsedSortOrder,
        prompt_label: promptLabel || null,
        is_default_prompt: isDefaultPrompt,
      });

      const parentName = ingredients.find((item) => item.id === parentId)?.name ?? `ID ${parentId}`;
      const childName = ingredients.find((item) => item.id === childId)?.name ?? `ID ${childId}`;

      setSuccessMessage(`Mapping ${parentName} -> ${childName} gespeichert.`);
      if (created.prompt_label === '' || created.prompt_label === null) {
        created.prompt_label = null;
      }

      setMappings((previous) => {
        const existing = previous.findIndex(
          (entry) =>
            entry.parent_ingredient_id === parentId && entry.child_ingredient_id === childId,
        );

        if (existing === -1) {
          return [...previous, created].sort((left, right) => {
            if (left.parent_name !== right.parent_name) {
              return left.parent_name.localeCompare(right.parent_name);
            }
            return left.sort_order - right.sort_order;
          });
        }

        const updated = [...previous];
        updated[existing] = created;
        return updated;
      });

      setParentQuery('');
      setChildQuery('');
      setPromptLabel('');
      setSortOrder(DEFAULT_SORT_ORDER);
      setIsDefaultPrompt(false);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const deleteMapping = async (row: AdminIngredientSubIngredient) => {
    const confirmed = window.confirm(`Mapping "${row.parent_name}" -> "${row.child_name}" loeschen?`);
    if (!confirmed) {
      return;
    }

    const key = `${row.parent_ingredient_id}:${row.child_ingredient_id}`;
    setDeletingId(key);
    setActionError('');
    setSuccessMessage('');

    try {
      await deleteIngredientSubIngredient(row.parent_ingredient_id, row.child_ingredient_id);
      setMappings((previous) =>
        previous.filter(
          (current) =>
            !(
              current.parent_ingredient_id === row.parent_ingredient_id &&
              current.child_ingredient_id === row.child_ingredient_id
            ),
        ),
      );
      setSuccessMessage(`Mapping ${row.parent_name} -> ${row.child_name} entfernt.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ingredient Sub-Ingredients</h2>
            <p className="mt-1 text-sm text-gray-600 max-w-3xl">
              Pflegt Parent-Child-Mappings zwischen Wirkstoffen inklusive optionalem Prompt-Text.
            </p>
          </div>
          {successMessage ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle size={16} />
              {successMessage}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Parent Filter
            <input
              value={parentFilter}
              onChange={(event) => setParentFilter(event.target.value)}
              placeholder="z. B. L-Carnitin"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Child Filter
            <input
              value={childFilter}
              onChange={(event) => setChildFilter(event.target.value)}
              placeholder="z. B. Acetyl-L-Carnitin"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 font-normal"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadMappings()}
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Search size={16} />
              Neu laden
            </button>
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle size={16} />
          {actionError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Neues Mapping anlegen</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Parent Wirkstoff
            <input
              value={parentQuery}
              onChange={(event) => setParentQuery(event.target.value)}
              list="parent-ingredient-options"
              placeholder="z. B. L-Carnitin"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            <datalist id="parent-ingredient-options">
              {parentSuggestions.map((ingredient) => (
                <option key={`parent-${ingredient.id}`} value={ingredientLabel(ingredient)} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Child Wirkstoff
            <input
              value={childQuery}
              onChange={(event) => setChildQuery(event.target.value)}
              list="child-ingredient-options"
              placeholder="z. B. Acetyl-L-Carnitin"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            <datalist id="child-ingredient-options">
              {childSuggestions.map((ingredient) => (
                <option key={`child-${ingredient.id}`} value={ingredientLabel(ingredient)} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Prompt Label (optional)
            <input
              value={promptLabel}
              onChange={(event) => setPromptLabel(event.target.value)}
              placeholder="z. B. sub ingredient prompt"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Sort Order
            <input
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </label>

          <label className="flex items-center gap-2 pt-5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isDefaultPrompt}
              onChange={(event) => setIsDefaultPrompt(event.target.checked)}
            />
            Default Prompt
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void createMapping()}
            disabled={creating || loadingIngredients}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Mapping speichern
          </button>
          <button
            type="button"
            onClick={() => {
              setParentQuery('');
              setChildQuery('');
              setPromptLabel('');
              setSortOrder(DEFAULT_SORT_ORDER);
              setIsDefaultPrompt(false);
              setActionError('');
            }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Zuruecksetzen
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Tipp: Label kann direkt aus der Vorschlagsliste kopiert werden.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">Bestehende Mappings</h3>
          <span className="text-sm text-gray-500">{filteredMappings.length} Treffer</span>
        </header>

        {loadingMappings ? (
          <div className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Lade Mappings...
            </div>
          </div>
        ) : null}

        {loadError ? (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

        {!loadingMappings && !loadError && filteredMappings.length === 0 ? (
          <p className="p-5 text-sm text-gray-500 text-center">Keine Mappings vorhanden.</p>
        ) : null}

        {!loadingMappings && filteredMappings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Parent</th>
                  <th className="py-2 px-3">Child</th>
                  <th className="py-2 px-3">Prompt</th>
                  <th className="py-2 px-3">Sort</th>
                  <th className="py-2 px-3">Default</th>
                  <th className="py-2 px-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.map((row) => {
                  const key = `${row.parent_ingredient_id}:${row.child_ingredient_id}`;
                  const isDeleting = deletingId === key;

                  return (
                    <tr key={key} className="border-b">
                      <td className="py-2 px-3">
                        <div className="font-medium">
                          {formatIngredientOption({ id: row.parent_ingredient_id, name: row.parent_name })}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium">
                          {formatIngredientOption({ id: row.child_ingredient_id, name: row.child_name })}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-700">{row.prompt_label || '-'}</td>
                      <td className="py-2 px-3 text-gray-700">{row.sort_order}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                            row.is_default_prompt ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {row.is_default_prompt ? 'Ja' : 'Nein'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => void deleteMapping(row)}
                          disabled={isDeleting}
                          className="min-h-11 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-red-600 hover:bg-red-50 border border-red-200 disabled:opacity-50"
                          aria-label={`Loeschen ${row.parent_name} -> ${row.child_name}`}
                        >
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Loeschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {loadingIngredients ? (
        <p className="text-sm text-gray-500">Lade Zutatenliste...</p>
      ) : (
        <details className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <summary className="text-sm font-semibold text-gray-900 cursor-pointer">
            Schnellzugriff Ingredients (erste 12)
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {ingredients.slice(0, 12).map((ingredient) => (
              <li key={ingredient.id} className="flex items-center justify-between gap-3">
                <span>{formatIngredientOption(ingredient)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setParentQuery(ingredientLabel(ingredient));
                  }}
                  className="text-xs text-indigo-600"
                >
                  als Parent
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
