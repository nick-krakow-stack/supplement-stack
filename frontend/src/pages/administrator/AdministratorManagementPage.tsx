import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { Archive, ArrowDown, ArrowUp, GripVertical, Plus, Save, X } from 'lucide-react';
import {
  createAdminManagedListItem,
  deactivateAdminManagedListItem,
  getAdminManagedListItems,
  reorderAdminManagedListItems,
  updateAdminManagedListItem,
  type AdminManagedListItem,
  type AdminManagedListKey,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type ManagedListConfig = {
  key: AdminManagedListKey;
  label: string;
};

type UnitDraft = {
  unit: string;
  plural_label: string;
  description: string;
};

const MANAGED_LISTS: ManagedListConfig[] = [
  {
    key: 'serving_unit',
    label: 'Einheiten',
  },
];

function emptyDraft(): UnitDraft {
  return {
    unit: '',
    plural_label: '',
    description: '',
  };
}

function draftFromItem(item: AdminManagedListItem): UnitDraft {
  return {
    unit: item.label || item.value,
    plural_label: item.plural_label ?? '',
    description: item.description ?? '',
  };
}

function getErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const apiError = typeof data?.error === 'string' ? data.error : null;
  if (apiError) return apiError;
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

function reorderItems(items: AdminManagedListItem[], fromId: number, toId: number): AdminManagedListItem[] {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function moveItem(items: AdminManagedListItem[], itemId: number, direction: -1 | 1): AdminManagedListItem[] {
  const index = items.findIndex((item) => item.id === itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, movedItem);
  return nextItems;
}

function withDisplayOrder(items: AdminManagedListItem[]): AdminManagedListItem[] {
  return items.map((item, index) => ({ ...item, sort_order: (index + 1) * 10 }));
}

export default function AdministratorManagementPage() {
  const [activeListKey, setActiveListKey] = useState<AdminManagedListKey>('serving_unit');
  const [items, setItems] = useState<AdminManagedListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<number | 'create' | 'deactivate' | 'reorder' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [draft, setDraft] = useState<UnitDraft>(() => emptyDraft());
  const [newDraft, setNewDraft] = useState<UnitDraft>(() => emptyDraft());

  const activeConfig = useMemo(
    () => MANAGED_LISTS.find((entry) => entry.key === activeListKey) ?? MANAGED_LISTS[0],
    [activeListKey],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminManagedListItems(activeListKey);
      setItems(response.items);
      setNewDraft(emptyDraft());
    } catch (errorValue) {
      setItems([]);
      setError(getErrorMessage(errorValue));
    } finally {
      setLoading(false);
    }
  }, [activeListKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = <K extends keyof UnitDraft>(field: K, value: UnitDraft[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const updateNewDraft = <K extends keyof UnitDraft>(field: K, value: UnitDraft[K]) => {
    setNewDraft((previous) => ({ ...previous, [field]: value }));
  };

  const handleStartEdit = (item: AdminManagedListItem) => {
    setEditingId(item.id);
    setDraft(draftFromItem(item));
    setError('');
    setMessage('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const handleCreate = async () => {
    const unit = newDraft.unit.trim();
    if (!unit) {
      setError('Einheit ist erforderlich.');
      return;
    }

    setSavingId('create');
    setError('');
    setMessage('');
    try {
      await createAdminManagedListItem(activeListKey, {
        value: unit,
        label: unit,
        plural_label: newDraft.plural_label.trim() || null,
        description: newDraft.description.trim() || null,
      });
      await load();
      setMessage('Einheit gespeichert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = async (item: AdminManagedListItem) => {
    const unit = draft.unit.trim();
    if (!unit) {
      setError('Einheit ist erforderlich.');
      return;
    }

    setSavingId(item.id);
    setError('');
    setMessage('');
    try {
      await updateAdminManagedListItem(
        activeListKey,
        item.id,
        {
          value: unit,
          label: unit,
          plural_label: draft.plural_label.trim() || null,
          description: draft.description.trim() || null,
        },
        { version: item.version },
      );
      await load();
      setEditingId(null);
      setMessage('Einheit aktualisiert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleDeactivate = async (item: AdminManagedListItem) => {
    if (!window.confirm(`Einheit "${item.label}" deaktivieren?`)) return;
    setSavingId('deactivate');
    setError('');
    setMessage('');
    try {
      await deactivateAdminManagedListItem(activeListKey, item.id, { version: item.version });
      await load();
      if (editingId === item.id) handleCancelEdit();
      setMessage('Einheit deaktiviert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const persistOrder = async (nextOrder: AdminManagedListItem[]) => {
    const previousItems = items;
    const orderedItems = withDisplayOrder(nextOrder);
    setItems(orderedItems);
    setSavingId('reorder');
    setError('');
    setMessage('');
    try {
      const response = await reorderAdminManagedListItems(
        activeListKey,
        orderedItems.map((item) => ({
          id: item.id,
          sort_order: item.sort_order,
          version: item.version,
        })),
      );
      setItems(response.items);
      setMessage('Reihenfolge gespeichert.');
    } catch (errorValue) {
      setItems(previousItems);
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleDropOnItem = (targetId: number) => {
    if (draggedItemId === null || draggedItemId === targetId) return;
    void persistOrder(reorderItems(items, draggedItemId, targetId));
    setDraggedItemId(null);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, itemId: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(itemId));
    setDraggedItemId(itemId);
  };

  const handleMove = (itemId: number, direction: -1 | 1) => {
    void persistOrder(moveItem(items, itemId, direction));
  };

  const renderDraftFields = (
    currentDraft: UnitDraft,
    onChange: <K extends keyof UnitDraft>(field: K, value: UnitDraft[K]) => void,
    action?: JSX.Element,
  ) => (
    <div className="admin-managed-row-form">
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Einheit
        <input
          value={currentDraft.unit}
          onChange={(event) => onChange('unit', event.target.value)}
          className="admin-input mt-1"
          maxLength={80}
        />
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Mehrzahl
        <input
          value={currentDraft.plural_label}
          onChange={(event) => onChange('plural_label', event.target.value)}
          className="admin-input mt-1"
          maxLength={120}
        />
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Beschreibung
        <input
          value={currentDraft.description}
          onChange={(event) => onChange('description', event.target.value)}
          className="admin-input mt-1"
          maxLength={500}
        />
      </label>
      {action ? <div className="admin-managed-form-action">{action}</div> : null}
    </div>
  );

  const reorderDisabled = savingId !== null || editingId !== null;

  return (
    <>
      <AdminPageHeader
        title="Verwaltung"
        subtitle="für wichtige Maßeinheiten und Einstellungen"
        meta={<AdminBadge tone="info">{items.filter((item) => item.active !== 0).length} aktiv</AdminBadge>}
      />

      <div className="admin-managed-tabs" role="tablist" aria-label="Verwaltete Listen">
        {MANAGED_LISTS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={activeListKey === entry.key}
            className={`admin-btn admin-btn-sm ${activeListKey === entry.key ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
            onClick={() => {
              setActiveListKey(entry.key);
              setEditingId(null);
              setMessage('');
              setError('');
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <h2 className="admin-section-title">Einheiten / Verabreichungsformen</h2>
      </div>

      {error ? <AdminError>{error}</AdminError> : null}
      {message ? (
        <div className="mb-4 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-success-soft)] bg-[color:var(--admin-success-soft)] px-3 py-2 text-[color:var(--admin-success-ink)] text-sm">
          {message}
        </div>
      ) : null}

      <AdminCard title="Neue Einheit" subtitle="Neue Verabreichungsform anlegen" padded>
        {renderDraftFields(
          newDraft,
          updateNewDraft,
          <AdminButton variant="primary" onClick={() => void handleCreate()} disabled={savingId === 'create'}>
            <Plus size={14} />
            {savingId === 'create' ? 'Speichere...' : 'Einheit anlegen'}
          </AdminButton>,
        )}
      </AdminCard>

      <AdminCard title={activeConfig.label} subtitle="Welche Verabreichungsform hat das Produkt?" className="mt-4">
        {loading ? <AdminEmpty>Lade Einheiten...</AdminEmpty> : null}
        {!loading && items.length === 0 ? <AdminEmpty>Keine Einheiten vorhanden.</AdminEmpty> : null}
        {!loading && items.length > 0 ? (
          <>
            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table admin-managed-table">
                <thead>
                  <tr>
                    <th>Einheit</th>
                    <th>Mehrzahl</th>
                    <th>Beschreibung</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                    <th aria-label="Reihenfolge" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    editingId === item.id ? (
                      <tr key={item.id}>
                        <td colSpan={6}>
                          {renderDraftFields(draft, updateDraft)}
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <AdminButton variant="ghost" size="sm" onClick={handleCancelEdit} disabled={savingId !== null}>
                              <X size={13} />
                              Abbrechen
                            </AdminButton>
                            <AdminButton variant="primary" size="sm" onClick={() => void handleSave(item)} disabled={savingId !== null}>
                              <Save size={13} />
                              {savingId === item.id ? 'Speichere...' : 'Speichern'}
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={item.id}
                        className={draggedItemId === item.id ? 'admin-managed-row-dragging' : undefined}
                        onDragOver={(event) => {
                          if (!reorderDisabled) event.preventDefault();
                        }}
                        onDrop={() => handleDropOnItem(item.id)}
                      >
                        <td className="font-medium">{item.label}</td>
                        <td>{item.plural_label || '-'}</td>
                        <td className="admin-muted">{item.description || '-'}</td>
                        <td>
                          <AdminBadge tone={item.active !== 0 ? 'ok' : 'neutral'}>
                            {item.active !== 0 ? 'aktiv' : 'inaktiv'}
                          </AdminBadge>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <AdminButton size="sm" variant="ghost" onClick={() => handleStartEdit(item)} disabled={savingId !== null}>
                              Bearbeiten
                            </AdminButton>
                            {item.active !== 0 ? (
                              <AdminButton size="sm" variant="danger" onClick={() => void handleDeactivate(item)} disabled={savingId !== null}>
                                <Archive size={13} />
                                Deaktivieren
                              </AdminButton>
                            ) : null}
                          </div>
                        </td>
                        <td className="admin-managed-order-cell">
                          <button
                            type="button"
                            className="admin-managed-drag-handle"
                            draggable={!reorderDisabled}
                            onDragStart={(event) => handleDragStart(event, item.id)}
                            onDragEnd={() => setDraggedItemId(null)}
                            disabled={reorderDisabled}
                            aria-label={`Einheit ${item.label} verschieben`}
                            title="Reihenfolge ändern"
                          >
                            <GripVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {items.map((item, index) => (
                <article
                  key={item.id}
                  className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3"
                  onDragOver={(event) => {
                    if (!reorderDisabled) event.preventDefault();
                  }}
                  onDrop={() => handleDropOnItem(item.id)}
                >
                  {editingId === item.id ? (
                    <>
                      {renderDraftFields(draft, updateDraft)}
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <AdminButton variant="ghost" size="sm" onClick={handleCancelEdit} disabled={savingId !== null}>
                          <X size={13} />
                          Abbrechen
                        </AdminButton>
                        <AdminButton variant="primary" size="sm" onClick={() => void handleSave(item)} disabled={savingId !== null}>
                          <Save size={13} />
                          Speichern
                        </AdminButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="admin-muted text-xs">Mehrzahl: {item.plural_label || '-'}</div>
                        </div>
                        <AdminBadge tone={item.active !== 0 ? 'ok' : 'neutral'}>
                          {item.active !== 0 ? 'aktiv' : 'inaktiv'}
                        </AdminBadge>
                      </div>
                      {item.description ? <p className="admin-muted mt-2 text-xs">{item.description}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          <AdminButton size="sm" variant="ghost" onClick={() => handleStartEdit(item)} disabled={savingId !== null}>
                            Bearbeiten
                          </AdminButton>
                          {item.active !== 0 ? (
                            <AdminButton size="sm" variant="danger" onClick={() => void handleDeactivate(item)} disabled={savingId !== null}>
                              <Archive size={13} />
                              Deaktivieren
                            </AdminButton>
                          ) : null}
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => handleMove(item.id, -1)}
                            disabled={reorderDisabled || index === 0}
                            aria-label={`${item.label} nach oben verschieben`}
                            title="Nach oben"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => handleMove(item.id, 1)}
                            disabled={reorderDisabled || index === items.length - 1}
                            aria-label={`${item.label} nach unten verschieben`}
                            title="Nach unten"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="admin-managed-drag-handle"
                            draggable={!reorderDisabled}
                            onDragStart={(event) => handleDragStart(event, item.id)}
                            onDragEnd={() => setDraggedItemId(null)}
                            disabled={reorderDisabled}
                            aria-label={`Einheit ${item.label} verschieben`}
                            title="Reihenfolge ändern"
                          >
                            <GripVertical size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </AdminCard>
    </>
  );
}
