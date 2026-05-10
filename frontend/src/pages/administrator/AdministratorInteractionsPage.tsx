import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LayoutGrid, List, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError } from './AdminUi';

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

type HoveredMatrixCell = {
  rowName: string;
  partnerName: string;
  cell: MatrixCell;
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

function matrixCellSymbol(severity: InteractionSeverity): string {
  return severity === 'info' || severity === 'medium' ? '·' : '!';
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<HoveredMatrixCell | null>(null);
  const [selectedMatrixIngredientIds, setSelectedMatrixIngredientIds] = useState<number[]>([]);

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

  const matrixIngredients = useMemo(() => {
    const ingredientNames = new Map<number, string>();
    ingredientIngredientInteractions.forEach((interaction) => {
      const rowId = interaction.ingredient_a_id;
      const rowLabel =
        ingredientNameById.get(rowId) ??
        interaction.ingredient_a_name ??
        `Wirkstoff #${rowId}`;
      ingredientNames.set(rowId, rowLabel);

      const partnerId = interaction.partner_ingredient_id;
      if (partnerId == null) return;
      const partnerLabel =
        ingredientNameById.get(partnerId) ??
        interaction.ingredient_b_name ??
        `Wirkstoff #${partnerId}`;
      ingredientNames.set(partnerId, partnerLabel);
    });
    return [...ingredientNames.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { sensitivity: 'base' }),
    );
  }, [ingredientIngredientInteractions, ingredientNameById]);

  useEffect(() => {
    setSelectedMatrixIngredientIds((previous) => {
      const available = new Set(matrixIngredients.map(([id]) => id));
      const retained = previous.filter((id) => available.has(id));
      if (retained.length > 0) return retained;
      return matrixIngredients.map(([id]) => id);
    });
  }, [matrixIngredients]);

  const selectedMatrixIngredientSet = useMemo(
    () => new Set(selectedMatrixIngredientIds),
    [selectedMatrixIngredientIds],
  );

  const visibleMatrixIngredients = useMemo(
    () => matrixIngredients.filter(([id]) => selectedMatrixIngredientSet.has(id)),
    [matrixIngredients, selectedMatrixIngredientSet],
  );

  const visibleIngredientIngredientInteractions = useMemo(
    () =>
      ingredientIngredientInteractions.filter(
        (interaction) =>
          selectedMatrixIngredientSet.has(interaction.ingredient_a_id) &&
          interaction.partner_ingredient_id != null &&
          selectedMatrixIngredientSet.has(interaction.partner_ingredient_id),
      ),
    [ingredientIngredientInteractions, selectedMatrixIngredientSet],
  );

  const ingredientMatrix = useMemo(() => {
    const matrix = new Map<number, Map<number, MatrixCell>>();

    visibleIngredientIngredientInteractions.forEach((interaction) => {
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
  }, [visibleIngredientIngredientInteractions]);

  const severityCounts = useMemo(() => {
    const counts: Record<InteractionSeverity, number> = {
      info: 0,
      medium: 0,
      high: 0,
      danger: 0,
    };
    filteredInteractions.forEach((interaction) => {
      counts[interaction.severity] += 1;
    });
    return counts;
  }, [filteredInteractions]);

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

  const toggleMatrixIngredient = (id: number) => {
    setSelectedMatrixIngredientIds((previous) =>
      previous.includes(id) ? previous.filter((currentId) => currentId !== id) : [...previous, id],
    );
  };

  return (
    <>
      <section className="admin-matrix-hero">
        <div>
          <h1>Wechselwirkungs-Matrix</h1>
          <p>Wechselwirkungen zwischen Wirkstoffen und anderen Faktoren prüfen.</p>
        </div>
        <div className="admin-matrix-hero-actions">
          <span className="admin-matrix-count admin-matrix-count-info">{severityCounts.info} info</span>
          <span className="admin-matrix-count admin-matrix-count-medium">{severityCounts.medium} mittel</span>
          <span className="admin-matrix-count admin-matrix-count-high">{severityCounts.high} hoch</span>
          <AdminButton variant="default" onClick={() => setShowCreateForm((value) => !value)}>
            <Plus size={18} />
            Hinzufügen
          </AdminButton>
        </div>
      </section>

      {showCreateForm ? (
      <AdminCard
        title={
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={18} className="text-[color:var(--admin-warn)]" />
            Wechselwirkung anlegen
          </span>
        }
        subtitle="Hinweis so formulieren, dass er später verständlich angezeigt wird."
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
      ) : null}

      {error && <AdminError>{error}</AdminError>}

      <AdminCard title="Übersicht" className="admin-compact-card mb-5" subtitle="Wechselwirkungen prüfen, filtern und bearbeiten.">
        <div className="admin-filter-bar mb-3">
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
          <div className="admin-filter-actions admin-btn-group">
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
          <>
          <div className="admin-filter-bar admin-filter-bar-flat mb-3">
            <div className="admin-filter-main">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--admin-ink-3)]">
                Aktive Wirkstoffe
              </span>
            </div>
            <div className="admin-filter-controls">
              {matrixIngredients.map(([id, name]) => (
                <label key={id} className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedMatrixIngredientSet.has(id)}
                    onChange={() => toggleMatrixIngredient(id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="max-w-[160px] truncate">{name}</span>
                </label>
              ))}
            </div>
            <div className="admin-filter-actions">
              <AdminButton size="sm" onClick={() => setSelectedMatrixIngredientIds(matrixIngredients.map(([id]) => id))}>
                Alle
              </AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => setSelectedMatrixIngredientIds([])}>
                Keine
              </AdminButton>
            </div>
          </div>
          {visibleMatrixIngredients.length === 0 ? (
            <AdminEmpty>Bitte mindestens einen Wirkstoff für die Matrix auswählen.</AdminEmpty>
          ) : (
          <div className="admin-interaction-matrix-wrap" style={{ padding: '24px 18px 18px', borderRadius: 12 }}>
            <div
              className="admin-interaction-matrix"
              style={{
                gridTemplateColumns: `160px repeat(${visibleMatrixIngredients.length}, 48px)`,
                rowGap: 10,
              }}
            >
              <div className="admin-interaction-matrix-corner" aria-hidden="true" style={{ height: 120 }} />
              {visibleMatrixIngredients.map(([partnerId, partnerName]) => (
                <div key={`head-${partnerId}`} className="admin-interaction-matrix-col" title={partnerName} style={{ height: 120, fontSize: 12 }}>
                  <span style={{ maxWidth: 118 }}>{partnerName}</span>
                </div>
              ))}

              {visibleMatrixIngredients.map(([ingredientIdRow, rowName]) => {
                const row = ingredientMatrix.get(ingredientIdRow);
                return (
                  <div key={`row-${ingredientIdRow}`} className="contents">
                    <div className="admin-interaction-matrix-row" style={{ paddingRight: 12, fontSize: 12 }}>{rowName}</div>
                    {visibleMatrixIngredients.map(([partnerId, partnerName]) => {
                      const cell = row?.get(partnerId);
                      if (ingredientIdRow === partnerId) {
                        return <div key={partnerId} className="admin-interaction-matrix-self" aria-hidden="true" style={{ width: 36 }} />;
                      }
                      if (!cell) {
                        return <div key={partnerId} className="admin-interaction-matrix-empty" aria-hidden="true" style={{ width: 36 }} />;
                      }

                      const summary = cell.interactions
                        .map((item) => [interactionTypeLabel(String(item.type)), item.mechanism, item.comment].filter(Boolean).join(': '))
                        .join('\n');
                      return (
                        <button
                          key={partnerId}
                          type="button"
                          className={`admin-interaction-matrix-cell admin-interaction-matrix-cell-${cell.maxSeverity}`}
                          title={summary}
                          aria-label={`${rowName} mit ${partnerName}: ${severityLabel(cell.maxSeverity)}`}
                          onMouseEnter={() => setHoveredMatrixCell({ rowName, partnerName, cell })}
                          onFocus={() => setHoveredMatrixCell({ rowName, partnerName, cell })}
                          style={{ width: 38, height: 26, fontSize: 14 }}
                        >
                          <span>{matrixCellSymbol(cell.maxSeverity)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div
              className="admin-interaction-matrix-footer"
              style={{
                position: 'sticky',
                bottom: 0,
                zIndex: 3,
                marginTop: 16,
                gap: 16,
                padding: '12px 0 0',
                background: 'var(--admin-bg-elev)',
              }}
            >
              <div>
                <div className="admin-interaction-matrix-footer-label">Legende</div>
                <div className="admin-interaction-legend">
                  <span className="admin-matrix-count admin-matrix-count-info">Info</span>
                  <span className="admin-matrix-count admin-matrix-count-medium">Mittel</span>
                  <span className="admin-matrix-count admin-matrix-count-high">Hoch</span>
                  <span className="admin-matrix-count admin-matrix-count-danger">Gefährlich</span>
                </div>
              </div>
              <div className="admin-interaction-hover-detail">
                <div className="admin-interaction-matrix-footer-label">Hover-Detail</div>
                {hoveredMatrixCell ? (
                  <>
                    <p className="font-medium text-[color:var(--admin-ink)]">
                      {hoveredMatrixCell.rowName} x {hoveredMatrixCell.partnerName}
                    </p>
                    <p>
                      {severityLabel(hoveredMatrixCell.cell.maxSeverity)} · {hoveredMatrixCell.cell.activeCount} aktiv
                      {hoveredMatrixCell.cell.inactiveCount > 0 ? ` · ${hoveredMatrixCell.cell.inactiveCount} inaktiv` : ''}
                    </p>
                    <p>{hoveredMatrixCell.cell.interactions[0]?.mechanism || hoveredMatrixCell.cell.interactions[0]?.comment || 'Kein Mechanismus hinterlegt.'}</p>
                  </>
                ) : (
                  <p>Zelle hovern für Mechanismus.</p>
                )}
              </div>
            </div>
          </div>
          )}
          </>
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
