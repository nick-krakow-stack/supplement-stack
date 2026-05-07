import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LayoutGrid, List, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type PartnerType = 'ingredient' | 'food' | 'medication' | 'condition';
type InteractionSeverity = 'info' | 'medium' | 'high' | 'danger';
type InteractionType = 'avoid' | 'caution' | 'danger';
type ActiveFilter = 'all' | 'active' | 'inactive';
type SeverityFilter = 'all' | InteractionSeverity;
type TypeFilter = 'all' | InteractionType;
type ViewMode = 'list' | 'matrix';
type PartnerTypeFilter = 'all' | PartnerType;

type Interaction = {
  id: number;
  ingredient_id: number;
  partner_type: PartnerType;
  partner_ingredient_id: number | null;
  partner_label: string | null;
  type: InteractionType | string;
  severity: InteractionSeverity;
  mechanism: string | null;
  comment: string | null;
  source_label: string | null;
  source_url: string | null;
  is_active: number;
  ingredient_a_id: number;
  ingredient_b_id: number | null;
  ingredient_a_name: string;
  ingredient_b_name: string | null;
  version: number | null;
};

type IngredientLookup = {
  id: number;
  name: string;
};

type MatrixCell = {
  interactions: Interaction[];
  activeCount: number;
  inactiveCount: number;
  maxSeverity: InteractionSeverity;
};

const ALL_ACTIVE_OPTIONS: ActiveFilter[] = ['all', 'active', 'inactive'];
const ALL_SEVERITY_OPTIONS: SeverityFilter[] = ['all', 'info', 'medium', 'high', 'danger'];
const ALL_TYPE_OPTIONS: TypeFilter[] = ['all', 'avoid', 'caution', 'danger'];
const ALL_PARTNER_TYPE_OPTIONS: PartnerTypeFilter[] = ['all', 'ingredient', 'food', 'medication', 'condition'];

const SEVERITY_SCORE: Record<InteractionSeverity, number> = {
  info: 1,
  medium: 2,
  high: 3,
  danger: 4,
};

const VIEW_MODES: Array<{ value: ViewMode; label: string }> = [
  { value: 'matrix', label: 'Matrix' },
  { value: 'list', label: 'Liste' },
];

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInitialActiveFilter(value: string | null): ActiveFilter {
  if (value === 'active' || value === '1' || value === 'true') return 'active';
  if (value === 'inactive' || value === '0' || value === 'false') return 'inactive';
  return 'all';
}

function parseInitialPartnerTypeFilter(value: string | null): PartnerTypeFilter {
  return value === 'ingredient' || value === 'food' || value === 'medication' || value === 'condition'
    ? value
    : 'all';
}

function isKnownInteractionType(type: string): type is InteractionType {
  return type === 'avoid' || type === 'caution' || type === 'danger';
}

function parseInteraction(raw: Record<string, unknown>): Interaction | null {
  const id = parseIntOrNull(raw.id) ?? undefined;
  const ingredientId = parseIntOrNull(raw.ingredient_id) ?? undefined;
  const ingredientAId = parseIntOrNull(raw.ingredient_a_id) ?? undefined;

  const partnerType = typeof raw.partner_type === 'string' ? raw.partner_type : undefined;
  const type = typeof raw.type === 'string' ? raw.type : undefined;
  const severity = typeof raw.severity === 'string' ? raw.severity : undefined;

  if (id == null || ingredientId == null || ingredientAId == null || !partnerType || !type || !severity) {
    return null;
  }

  const normalizedSeverity = severity === 'info' || severity === 'medium' || severity === 'high' || severity === 'danger'
    ? severity
    : 'info';

  return {
    id,
    ingredient_id: ingredientId,
    partner_type: partnerType as PartnerType,
    partner_ingredient_id: parseIntOrNull(raw.partner_ingredient_id),
    partner_label: typeof raw.partner_label === 'string' ? raw.partner_label : null,
    type,
    severity: normalizedSeverity,
    mechanism: typeof raw.mechanism === 'string' ? raw.mechanism : null,
    comment: typeof raw.comment === 'string' ? raw.comment : null,
    source_label: typeof raw.source_label === 'string' ? raw.source_label : null,
    source_url: typeof raw.source_url === 'string' ? raw.source_url : null,
    is_active: raw.is_active === 0 ? 0 : 1,
    ingredient_a_id: ingredientAId,
    ingredient_b_id:
      parseIntOrNull(raw.ingredient_b_id) ?? parseIntOrNull(raw.partner_ingredient_id),
    ingredient_a_name:
      typeof raw.ingredient_a_name === 'string' ? raw.ingredient_a_name : `Ingredient ${ingredientAId}`,
    ingredient_b_name:
      typeof raw.ingredient_b_name === 'string'
        ? raw.ingredient_b_name
        : typeof raw.partner_label === 'string'
          ? raw.partner_label
          : null,
    version: parseIntOrNull(raw.version),
  };
}

function interactionSeverityTone(severity: InteractionSeverity) {
  if (severity === 'danger' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warn';
  return 'info';
}

function interactionIsActive(interaction: Interaction): boolean {
  return interaction.is_active !== 0;
}

function interactionSeverityValue(interaction: Interaction | InteractionSeverity) {
  const value = typeof interaction === 'string' ? interaction : interaction.severity;
  return SEVERITY_SCORE[value] ?? 1;
}

function interactionActiveBadge(interaction: Interaction) {
  return interactionIsActive(interaction) ? (
    <AdminBadge tone="ok">aktiv</AdminBadge>
  ) : (
    <AdminBadge tone="neutral">inaktiv</AdminBadge>
  );
}

function partnerTypeLabel(value: PartnerTypeFilter): string {
  if (value === 'ingredient') return 'Wirkstoff';
  if (value === 'food') return 'Lebensmittel';
  if (value === 'medication') return 'Medikament';
  if (value === 'condition') return 'Erkrankung';
  return 'Alle Partner';
}

function interactionTypeLabel(value: TypeFilter | string): string {
  if (value === 'avoid') return 'Nicht kombinieren';
  if (value === 'caution') return 'Mit Vorsicht';
  if (value === 'danger') return 'Kritisch';
  if (value === 'all') return 'Alle Hinweise';
  return 'Sonstiger Hinweis';
}

function severityLabel(value: SeverityFilter | string): string {
  if (value === 'info') return 'Hinweis';
  if (value === 'medium') return 'Mittel';
  if (value === 'high') return 'Hoch';
  if (value === 'danger') return 'Kritisch';
  return 'Alle Schweregrade';
}

function severityBadge(severity: InteractionSeverity) {
  return <AdminBadge tone={interactionSeverityTone(severity)}>{severityLabel(severity)}</AdminBadge>;
}

export default function AdministratorInteractionsPage() {
  const [searchParams] = useSearchParams();
  const [ingredients, setIngredients] = useState<IngredientLookup[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [ingredientId, setIngredientId] = useState('');
  const [partnerType, setPartnerType] = useState<PartnerType>('ingredient');
  const [partnerIngredientId, setPartnerIngredientId] = useState('');
  const [partnerLabel, setPartnerLabel] = useState('');
  const [type, setType] = useState<InteractionType>('avoid');
  const [severity, setSeverity] = useState<InteractionSeverity>('medium');
  const [mechanism, setMechanism] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [comment, setComment] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(() => parseInitialActiveFilter(searchParams.get('active')));
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<PartnerTypeFilter>(() => parseInitialPartnerTypeFilter(searchParams.get('partner_type')));
  const [ingredientFilterId, setIngredientFilterId] = useState(() => {
    const value = searchParams.get('ingredient_id') ?? '';
    return /^\d+$/.test(value) ? value : '';
  });
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const ingredientNameById = useMemo(() => {
    const map = new Map<number, string>();
    ingredients.forEach((ingredient) => {
      map.set(ingredient.id, ingredient.name);
    });
    return map;
  }, [ingredients]);

  const loadInteractions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interactions', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Wechselwirkungen konnten nicht geladen werden.');
      const payload = await res.json();
      const rows = (Array.isArray(payload?.interactions)
        ? payload.interactions
        : []) as Array<Record<string, unknown>>;
      const parsed = rows
        .map((row) => parseInteraction(row))
        .filter((entry): entry is Interaction => entry !== null);
      setInteractions(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIngredients = useCallback(async () => {
    try {
      const res = await fetch('/api/ingredients', { credentials: 'include' });
      if (!res.ok) return;
      const payload = await res.json();
      const rows = Array.isArray(payload?.ingredients) ? payload.ingredients : [];
      const mapped = rows
        .map((row: { id: number; name: string }) => ({ id: row.id, name: row.name }))
        .filter((entry: IngredientLookup) => Number.isFinite(entry.id) && typeof entry.name === 'string')
        .sort((left: IngredientLookup, right: IngredientLookup) => left.name.localeCompare(right.name));
      setIngredients(mapped);
    } catch {
      // keep list empty on error; create flow validates required values
    }
  }, []);

  useEffect(() => {
    loadIngredients();
    loadInteractions();
  }, [loadIngredients, loadInteractions]);

  const ingredientName = useCallback(
    (interaction: Interaction) => {
      return (
        ingredientNameById.get(interaction.ingredient_a_id) ??
        interaction.ingredient_a_name ??
        `Wirkstoff #${interaction.ingredient_a_id}`
      );
    },
    [ingredientNameById],
  );

  const partnerDisplay = useCallback(
    (interaction: Interaction) => {
      if (interaction.partner_type === 'ingredient') {
        return (
          interaction.partner_ingredient_id != null
            ? ingredientNameById.get(interaction.partner_ingredient_id) ?? interaction.ingredient_b_name
            : interaction.ingredient_b_name
        );
      }

      if (interaction.partner_label) return interaction.partner_label;
      return interaction.ingredient_b_name ?? 'Unbekannt';
    },
    [ingredientNameById],
  );

  const filteredInteractions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedIngredientFilter = ingredientFilterId ? Number(ingredientFilterId) : null;
    return interactions.filter((interaction) => {
      if (
        normalizedIngredientFilter !== null &&
        interaction.ingredient_id !== normalizedIngredientFilter &&
        interaction.partner_ingredient_id !== normalizedIngredientFilter
      ) {
        return false;
      }
      if (activeFilter === 'active' && !interactionIsActive(interaction)) return false;
      if (activeFilter === 'inactive' && interactionIsActive(interaction)) return false;
      if (severityFilter !== 'all' && interaction.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && interaction.type !== typeFilter) return false;
      if (partnerTypeFilter !== 'all' && interaction.partner_type !== partnerTypeFilter) return false;
      if (normalizedQuery) {
        const haystack = [
          ingredientName(interaction),
          partnerDisplay(interaction),
          interaction.partner_type,
          interaction.type,
          interaction.severity,
          interaction.mechanism,
          interaction.comment,
          interaction.source_label,
          interaction.source_url,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [interactions, activeFilter, ingredientFilterId, ingredientName, partnerDisplay, partnerTypeFilter, query, severityFilter, typeFilter]);

  const ingredientIngredientInteractions = useMemo(
    () =>
      filteredInteractions.filter((interaction) => interaction.partner_type === 'ingredient' && interaction.partner_ingredient_id != null),
    [filteredInteractions],
  );

  const ingredientMatrixColumns = useMemo(() => {
    const columnNames = new Map<number, string>();
    ingredientIngredientInteractions.forEach((interaction) => {
      const columnId = interaction.partner_ingredient_id;
      if (columnId == null) return;
      const label =
        ingredientNameById.get(columnId) ??
        interaction.ingredient_b_name ??
        `Wirkstoff #${columnId}`;
      columnNames.set(columnId, label);
    });
    return [...columnNames.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { sensitivity: 'base' }),
    );
  }, [ingredientIngredientInteractions, ingredientNameById]);

  const ingredientMatrixRows = useMemo(() => {
    const rowNames = new Map<number, string>();
    ingredientIngredientInteractions.forEach((interaction) => {
      const rowId = interaction.ingredient_a_id;
      const rowLabel =
        ingredientNameById.get(rowId) ??
        interaction.ingredient_a_name ??
        `Wirkstoff #${rowId}`;
      rowNames.set(rowId, rowLabel);
    });
    return [...rowNames.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { sensitivity: 'base' }),
    );
  }, [ingredientIngredientInteractions, ingredientNameById]);

  const ingredientMatrix = useMemo(() => {
    const matrix = new Map<number, Map<number, MatrixCell>>();

    ingredientIngredientInteractions.forEach((interaction) => {
      const rowId = interaction.ingredient_a_id;
      const colId = interaction.partner_ingredient_id;
      if (colId == null) return;

      const rowMap = matrix.get(rowId) ?? new Map<number, MatrixCell>();
      const cell = rowMap.get(colId) ?? {
        interactions: [],
        activeCount: 0,
        inactiveCount: 0,
        maxSeverity: interaction.severity,
      };

      cell.interactions.push(interaction);
      if (interactionIsActive(interaction)) {
        cell.activeCount += 1;
      } else {
        cell.inactiveCount += 1;
      }
      if (interactionSeverityValue(interaction) >= interactionSeverityValue(cell.maxSeverity)) {
        cell.maxSeverity = interaction.severity;
      }
      rowMap.set(colId, cell);
      matrix.set(rowId, rowMap);
    });

    return matrix;
  }, [ingredientIngredientInteractions]);

  const resetForm = () => {
    setIngredientId('');
    setPartnerType('ingredient');
    setPartnerIngredientId('');
    setPartnerLabel('');
    setType('avoid');
    setSeverity('medium');
    setMechanism('');
    setSourceLabel('');
    setSourceUrl('');
    setIsActive(true);
    setComment('');
  };

  const handleCreate = async () => {
    if (!ingredientId) {
      setError('Der erste Wirkstoff fehlt.');
      return;
    }

    if (partnerType === 'ingredient' && !partnerIngredientId) {
      setError('Der zweite Wirkstoff fehlt.');
      return;
    }

    if (partnerType === 'ingredient' && Number(partnerIngredientId) === Number(ingredientId)) {
      setError('Bitte zwei unterschiedliche Wirkstoffe wählen.');
      return;
    }

    if (partnerType !== 'ingredient' && !partnerLabel.trim()) {
      setError('Bitte den Partner benennen, z. B. ein Medikament oder Lebensmittel.');
      return;
    }

    if (!comment.trim()) {
      setError('Kommentar fehlt.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ingredient_id: Number(ingredientId),
        partner_type: partnerType,
        type,
        severity,
        mechanism: mechanism.trim() || null,
        source_label: sourceLabel.trim() || null,
        source_url: sourceUrl.trim() || null,
        comment: comment.trim(),
        is_active: isActive ? 1 : 0,
        ...(partnerType === 'ingredient'
          ? { partner_ingredient_id: Number(partnerIngredientId) }
          : { partner_label: partnerLabel.trim() }),
      } as {
        ingredient_id: number;
        partner_type: PartnerType;
        type: InteractionType;
        severity: InteractionSeverity;
        mechanism: string | null;
        source_label: string | null;
        source_url: string | null;
        comment: string;
        is_active: number;
        partner_ingredient_id?: number;
        partner_label?: string;
      };

      const res = await fetch('/api/interactions', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const response = await res.json().catch(() => null);
        const message = typeof response?.error === 'string' ? response.error : 'Wechselwirkung konnte nicht erstellt werden.';
        throw new Error(message);
      }

      resetForm();
      await loadInteractions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (interaction: Interaction) => {
    if (!window.confirm('Wechselwirkung löschen?')) return;

    const { id } = interaction;
    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`/api/interactions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...authHeaders(),
          ...(interaction.version === null ? {} : { 'If-Match': String(interaction.version) }),
        },
      });
      if (!res.ok) {
        const response = await res.json().catch(() => null);
        const message = typeof response?.error === 'string' ? response.error : 'Löschen fehlgeschlagen.';
        throw new Error(message);
      }
      setInteractions((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Wechselwirkungs-Matrix"
        subtitle="Wechselwirkungen zwischen Wirkstoffen, Lebensmitteln, Medikamenten und Erkrankungen prüfen und pflegen."
        meta={
          <span className="admin-toolbar-inline">
            <AdminBadge tone="info">{interactions.length} insgesamt</AdminBadge>
            <AdminBadge tone="neutral">{filteredInteractions.length} gefiltert</AdminBadge>
            <AdminBadge tone="ok">{ingredientIngredientInteractions.length} Wirkstoff-Paare</AdminBadge>
          </span>
        }
      />

      <AdminCard
        title={
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={18} className="text-[color:var(--admin-warn)]" />
            Wechselwirkung anlegen
          </span>
        }
        subtitle="Neue Hinweise so eintragen, wie sie später im Produkt- und Stack-Kontext erscheinen sollen."
        padded
        className="mb-5"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Erster Wirkstoff
            <select
              value={ingredientId}
              onChange={(event) => setIngredientId(event.target.value)}
              className="admin-select mt-1"
            >
              <option value="">Bitte ausw&auml;hlen</option>
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Art des Partners
            <select
              value={partnerType}
              onChange={(event) => setPartnerType(event.target.value as PartnerType)}
              className="admin-select mt-1"
            >
              <option value="ingredient">zweiter Wirkstoff</option>
              <option value="food">Lebensmittel</option>
              <option value="medication">Medikament</option>
              <option value="condition">Erkrankung</option>
            </select>
          </label>

          {partnerType === 'ingredient' ? (
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Zweiter Wirkstoff
              <select
                value={partnerIngredientId}
                onChange={(event) => setPartnerIngredientId(event.target.value)}
                className="admin-select mt-1"
              >
                <option value="">Bitte ausw&auml;hlen</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Name des Partners
              <input
                value={partnerLabel}
                onChange={(event) => setPartnerLabel(event.target.value)}
                placeholder="z. B. Kaffee, ASS oder Bluthochdruck"
                className="admin-input mt-1"
              />
            </label>
          )}

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Empfehlung
            <select
              value={type}
              onChange={(event) => setType(event.target.value as InteractionType)}
              className="admin-select mt-1"
            >
              <option value="avoid">Nicht kombinieren</option>
              <option value="caution">Mit Vorsicht</option>
              <option value="danger">Kritisch</option>
            </select>
          </label>

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Schweregrad
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as InteractionSeverity)}
              className="admin-select mt-1"
            >
              <option value="info">Hinweis</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
              <option value="danger">Kritisch</option>
            </select>
          </label>

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Warum ist das relevant?
            <input
              value={mechanism}
              onChange={(event) => setMechanism(event.target.value)}
              placeholder="z. B. Aufnahme, Blutdruck, Gerinnung"
              className="admin-input mt-1"
            />
          </label>

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Quellenname
            <input
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
              placeholder="z. B. EFSA, Fachinformation, Studie"
              className="admin-input mt-1"
            />
          </label>

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Quellen-Link
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
              className="admin-input mt-1"
            />
          </label>

          <div className="flex items-center gap-2">
            <input
              id="interaction-active"
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="interaction-active" className="text-sm text-[color:var(--admin-ink-2)]">
              Aktiv
            </label>
          </div>

          <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
            Hinweistext
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Kurz und verständlich für die spätere Anzeige"
              className="admin-input mt-1"
            />
          </label>

          <AdminButton
            variant="primary"
            onClick={handleCreate}
            disabled={saving}
            className="md:col-span-2"
          >
            <Plus size={16} />
            {saving ? 'Speichere...' : 'Neue Wechselwirkung speichern'}
          </AdminButton>
        </div>
      </AdminCard>

      {error && <AdminError>{error}</AdminError>}

      <AdminCard title="Übersicht" className="mb-5" subtitle="Filter setzen und zwischen Matrix und Liste wechseln.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 mb-3">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Wirkstoff
            <select
              value={ingredientFilterId}
              onChange={(event) => setIngredientFilterId(event.target.value)}
              className="admin-select mt-1"
            >
              <option value="">Alle Wirkstoffe</option>
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Suche
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="admin-input mt-1"
              placeholder="Wirkstoff oder Quelle"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Status
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
              className="admin-select mt-1"
            >
              {ALL_ACTIVE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'Alle' : option === 'active' ? 'Aktiv' : 'Inaktiv'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Schweregrad
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
              className="admin-select mt-1"
            >
              {ALL_SEVERITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {severityLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Empfehlung
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="admin-select mt-1"
            >
              {ALL_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {interactionTypeLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Partnerart
            <select
              value={partnerTypeFilter}
              onChange={(event) => setPartnerTypeFilter(event.target.value as PartnerTypeFilter)}
              className="admin-select mt-1"
            >
              {ALL_PARTNER_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {partnerTypeLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-toolbar-inline admin-btn-group md:col-span-2 xl:col-span-6">
            {VIEW_MODES.map((mode) => (
              <AdminButton
                key={mode.value}
                variant={viewMode === mode.value ? 'primary' : 'default'}
                size="sm"
                onClick={() => setViewMode(mode.value)}
              >
                {mode.value === 'matrix' ? <LayoutGrid size={13} /> : <List size={13} />}
                {mode.label}
              </AdminButton>
            ))}
          </div>
        </div>

        {loading ? (
          <AdminEmpty>Laden...</AdminEmpty>
        ) : filteredInteractions.length === 0 ? (
          <AdminEmpty>Keine Einträge für die aktuelle Filterung.</AdminEmpty>
        ) : viewMode === 'matrix' ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-matrix">
              <thead>
                <tr>
                  <th>Erster Wirkstoff</th>
                  {ingredientMatrixColumns.map(([partnerId, partnerName]) => (
                    <th key={partnerId} title={partnerName}>
                      {partnerName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ingredientMatrixRows.map(([ingredientIdRow, rowName]) => {
                  const row = ingredientMatrix.get(ingredientIdRow);
                  return (
                    <tr key={ingredientIdRow}>
                      <td>
                        <strong>{rowName}</strong>
                        <p className="admin-muted text-xs">ID {ingredientIdRow}</p>
                      </td>
                      {ingredientMatrixColumns.map(([partnerId]) => {
                        const cell = row?.get(partnerId);
                        if (!cell) {
                          return (
                            <td key={partnerId} className="admin-matrix-empty">
                              -
                            </td>
                          );
                        }

                        const typeLabels = new Set(cell.interactions.map((item) => interactionTypeLabel(String(item.type))));
                        return (
                          <td key={partnerId} className="admin-matrix-cell">
                            <div className="admin-toolbar-inline">
                              {severityBadge(cell.maxSeverity)}
                              <AdminBadge tone="neutral">
                                {cell.activeCount > 0 ? 'aktiv' : 'inaktiv'}
                              </AdminBadge>
                            </div>
                            <div className="admin-muted mt-1 text-xs">
                              {Array.from(typeLabels).slice(0, 2).join(', ') || '-'}
                            </div>
                            {cell.inactiveCount > 0 && cell.activeCount > 0 ? (
                              <div className="admin-muted mt-1 text-[11px]">
                                {cell.activeCount} A / {cell.inactiveCount} I
                              </div>
                            ) : null}
                            {cell.interactions.length > 1 ? (
                              <div className="admin-muted mt-1 text-[11px]">{cell.interactions.length}x</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Erster Wirkstoff</th>
                  <th>Partner</th>
                  <th>Typ</th>
                  <th>Schweregrad</th>
                  <th>Quelle</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredInteractions.map((interaction) => {
                  const rowSource = interaction.source_label || interaction.source_url || '-';
                  return (
                    <tr key={interaction.id}>
                      <td>
                        <p>{ingredientName(interaction)}</p>
                        <p className="admin-muted text-xs">ID {interaction.ingredient_a_id}</p>
                      </td>
                      <td>
                        <p>{partnerDisplay(interaction)}</p>
                        <p className="admin-muted text-xs">{partnerTypeLabel(interaction.partner_type as PartnerType)}</p>
                      </td>
                      <td>
                        <AdminBadge>{isKnownInteractionType(interaction.type) ? interactionTypeLabel(interaction.type) : 'Sonstiger Hinweis'}</AdminBadge>
                        {interaction.mechanism && <p className="admin-muted mt-1 text-xs">{interaction.mechanism}</p>}
                      </td>
                      <td>{severityBadge(interaction.severity)}</td>
                      <td>
                        <p className="max-w-[220px] break-words">{rowSource}</p>
                      </td>
                      <td>{interactionActiveBadge(interaction)}</td>
                      <td className="text-right">
                        <AdminButton
                          variant="ghost"
                          onClick={() => handleDelete(interaction)}
                          disabled={deletingId === interaction.id}
                          aria-label="Eintrag löschen"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
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
    </>
  );
}
