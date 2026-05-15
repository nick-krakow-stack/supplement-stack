import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Plus, RefreshCw, Save, X } from 'lucide-react';
import {
  createAdminManagedListItem,
  deactivateAdminManagedListItem,
  getAdminManagedListItems,
  updateAdminManagedListItem,
  type AdminManagedListItem,
  type AdminManagedListKey,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type ManagedListConfig = {
  key: AdminManagedListKey;
  label: string;
  description: string;
};

type UnitDraft = {
  value: string;
  label: string;
  description: string;
  sort_order: string;
  active: boolean;
};

const MANAGED_LISTS: ManagedListConfig[] = [
  {
    key: 'serving_unit',
    label: 'Einheiten',
    description: 'Zentral gepflegte Auswahl fuer Produkt-Portionseinheiten.',
  },
];

function emptyDraft(nextSortOrder: number): UnitDraft {
  return {
    value: '',
    label: '',
    description: '',
    sort_order: String(nextSortOrder),
    active: true,
  };
}

function draftFromItem(item: AdminManagedListItem): UnitDraft {
  return {
    value: item.value,
    label: item.label,
    description: item.description ?? '',
    sort_order: String(item.sort_order),
    active: item.active !== 0,
  };
}

function parseSortOrder(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed)) throw new Error('Sortierung muss eine ganze Zahl sein.');
  return parsed;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('de-DE');
}

function getErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const apiError = typeof data?.error === 'string' ? data.error : null;
  if (apiError) return apiError;
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

export default function AdministratorManagementPage() {
  const [activeListKey, setActiveListKey] = useState<AdminManagedListKey>('serving_unit');
  const [items, setItems] = useState<AdminManagedListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<number | 'create' | 'deactivate' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<UnitDraft>(() => emptyDraft(10));
  const [newDraft, setNewDraft] = useState<UnitDraft>(() => emptyDraft(10));

  const activeConfig = useMemo(
    () => MANAGED_LISTS.find((entry) => entry.key === activeListKey) ?? MANAGED_LISTS[0],
    [activeListKey],
  );
  const nextSortOrder = useMemo(
    () => (items.length === 0 ? 10 : Math.max(...items.map((item) => item.sort_order)) + 10),
    [items],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminManagedListItems(activeListKey, { includeInactive: true });
      setItems(response.items);
      setNewDraft(emptyDraft(response.items.length === 0 ? 10 : Math.max(...response.items.map((item) => item.sort_order)) + 10));
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
    setDraft(emptyDraft(nextSortOrder));
  };

  const handleCreate = async () => {
    const value = newDraft.value.trim();
    const label = newDraft.label.trim();
    if (!value || !label) {
      setError('Wert und Anzeige sind erforderlich.');
      return;
    }

    setSavingId('create');
    setError('');
    setMessage('');
    try {
      await createAdminManagedListItem(activeListKey, {
        value,
        label,
        description: newDraft.description.trim() || null,
        sort_order: parseSortOrder(newDraft.sort_order),
        active: newDraft.active ? 1 : 0,
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
    const value = draft.value.trim();
    const label = draft.label.trim();
    if (!value || !label) {
      setError('Wert und Anzeige sind erforderlich.');
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
          value,
          label,
          description: draft.description.trim() || null,
          sort_order: parseSortOrder(draft.sort_order),
          active: draft.active ? 1 : 0,
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

  const renderDraftFields = (
    currentDraft: UnitDraft,
    onChange: <K extends keyof UnitDraft>(field: K, value: UnitDraft[K]) => void,
  ) => (
    <div className="admin-managed-row-form">
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Wert
        <input
          value={currentDraft.value}
          onChange={(event) => onChange('value', event.target.value)}
          className="admin-input mt-1"
          maxLength={80}
        />
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Anzeige
        <input
          value={currentDraft.label}
          onChange={(event) => onChange('label', event.target.value)}
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
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Sortierung
        <input
          value={currentDraft.sort_order}
          onChange={(event) => onChange('sort_order', event.target.value)}
          className="admin-input mt-1"
          inputMode="numeric"
        />
      </label>
      <label className="inline-flex min-h-[38px] items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)]">
        <input
          type="checkbox"
          checked={currentDraft.active}
          onChange={(event) => onChange('active', event.target.checked)}
        />
        Aktiv
      </label>
    </div>
  );

  return (
    <>
      <AdminPageHeader
        title="Verwaltung"
        subtitle="Zentrale Listen fuer Admin-Auswahlen pflegen."
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="admin-muted text-sm">{activeConfig.description}</p>
        <AdminButton onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </AdminButton>
      </div>

      {error ? <AdminError>{error}</AdminError> : null}
      {message ? (
        <div className="mb-4 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-success-soft)] bg-[color:var(--admin-success-soft)] px-3 py-2 text-[color:var(--admin-success-ink)] text-sm">
          {message}
        </div>
      ) : null}

      <AdminCard title="Neue Einheit" subtitle="Neue Werte erscheinen direkt in den passenden Admin-Dropdowns." padded>
        {renderDraftFields(newDraft, updateNewDraft)}
        <div className="mt-3 flex justify-end">
          <AdminButton variant="primary" onClick={() => void handleCreate()} disabled={savingId === 'create'}>
            <Plus size={14} />
            {savingId === 'create' ? 'Speichere...' : 'Einheit anlegen'}
          </AdminButton>
        </div>
      </AdminCard>

      <AdminCard title="Einheiten" subtitle="Werte koennen bearbeitet oder deaktiviert werden." className="mt-4">
        {loading ? <AdminEmpty>Lade Einheiten...</AdminEmpty> : null}
        {!loading && items.length === 0 ? <AdminEmpty>Keine Einheiten vorhanden.</AdminEmpty> : null}
        {!loading && items.length > 0 ? (
          <>
            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Wert</th>
                    <th>Anzeige</th>
                    <th>Beschreibung</th>
                    <th>Status</th>
                    <th>Sortierung</th>
                    <th>Aktualisiert</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    editingId === item.id ? (
                      <tr key={item.id}>
                        <td colSpan={7}>
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
                      <tr key={item.id}>
                        <td className="admin-mono">{item.value}</td>
                        <td>{item.label}</td>
                        <td className="admin-muted">{item.description || '-'}</td>
                        <td>
                          <AdminBadge tone={item.active !== 0 ? 'ok' : 'neutral'}>
                            {item.active !== 0 ? 'aktiv' : 'inaktiv'}
                          </AdminBadge>
                        </td>
                        <td className="admin-mono">{item.sort_order}</td>
                        <td className="admin-muted">{formatDate(item.updated_at)}</td>
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
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {items.map((item) => (
                <article key={item.id} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
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
                          <div className="admin-mono admin-muted text-xs">{item.value}</div>
                        </div>
                        <AdminBadge tone={item.active !== 0 ? 'ok' : 'neutral'}>
                          {item.active !== 0 ? 'aktiv' : 'inaktiv'}
                        </AdminBadge>
                      </div>
                      {item.description ? <p className="admin-muted mt-2 text-xs">{item.description}</p> : null}
                      <div className="admin-muted mt-2 text-xs">Sortierung {item.sort_order} · {formatDate(item.updated_at)}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
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
