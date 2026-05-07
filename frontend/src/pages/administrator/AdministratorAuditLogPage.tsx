import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, X } from 'lucide-react';
import { getAuditLog, type AdminAuditLogEntry } from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type AuditLogFilter = {
  action: string;
  entity_type: string;
  user_id: string;
  date_from: string;
  date_to: string;
};

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

function emptyFilters(): AuditLogFilter {
  return {
    action: '',
    entity_type: '',
    user_id: '',
    date_from: '',
    date_to: '',
  };
}

function compact(value: string): string {
  return value.trim();
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return parsed.toLocaleString('de-DE');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasBeforeAfter(value: unknown): value is { before?: unknown; after?: unknown } {
  return isRecord(value) && ('before' in value || 'after' in value);
}

function isSimpleValue(value: unknown): boolean {
  return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (isSimpleValue(left) || isSimpleValue(right)) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return '-';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length > 0 ? value : '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

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
  return 'Audit-Log konnte nicht geladen werden.';
}

function actionTone(action: string): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  const normalized = action.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('reject')) return 'danger';
  if (normalized.includes('approve') || normalized.includes('publish')) return 'ok';
  if (normalized.includes('update') || normalized.includes('repair')) return 'warn';
  if (normalized.includes('create') || normalized.includes('insert')) return 'info';
  return 'neutral';
}

function hasDetails(entry: AdminAuditLogEntry): boolean {
  return Boolean(entry.changes || entry.reason?.trim() || entry.ip_address || entry.user_agent);
}

function ChangeValue({ value, muted = false }: { value: unknown; muted?: boolean }) {
  return (
    <code
      className={`block max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] px-2 py-1.5 font-mono text-[11.5px] ${
        muted
          ? 'bg-[color:var(--admin-bg-sunk)] text-[color:var(--admin-ink-3)]'
          : 'bg-[color:var(--admin-bg-elev)] text-[color:var(--admin-ink)]'
      }`}
    >
      {stringifyValue(value)}
    </code>
  );
}

type ChangeDiffRow = {
  field: string;
  before: unknown;
  after: unknown;
};

function buildTopLevelDiffRows(before: unknown, after: unknown): ChangeDiffRow[] {
  if (isRecord(before) && isRecord(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort((left, right) =>
      left.localeCompare(right, 'de-DE'),
    );
    const changedRows = keys
      .map((field) => ({ field, before: before[field], after: after[field] }))
      .filter((row) => !valuesEqual(row.before, row.after));
    return changedRows.length > 0
      ? changedRows
      : keys.map((field) => ({ field, before: before[field], after: after[field] }));
  }

  return [{ field: 'Wert', before, after }];
}

function DiffRowsTable({ rows }: { rows: ChangeDiffRow[] }) {
  return (
    <div>
      <div className="mb-1 grid gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[color:var(--admin-ink-3)] md:grid-cols-[minmax(120px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <span>Feld</span>
        <span>Vorher</span>
        <span>Nachher</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.field}
            className="grid gap-2 rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2 md:grid-cols-[minmax(120px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div className="font-medium text-[color:var(--admin-ink-2)]">{row.field}</div>
            <div>
              <div className="admin-muted mb-1 text-[11px] md:hidden">Vorher</div>
              <ChangeValue value={row.before} muted />
            </div>
            <div>
              <div className="admin-muted mb-1 text-[11px] md:hidden">Nachher</div>
              <ChangeValue value={row.after} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangesRenderer({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes);

  if (entries.length === 0) {
    return <div className="admin-muted text-xs">Keine Feldwerte im Change-Objekt.</div>;
  }

  const topLevelDiff = hasBeforeAfter(changes)
    ? buildTopLevelDiffRows(changes.before, changes.after)
    : [];
  const reservedTopLevelKeys = new Set(topLevelDiff.length > 0 ? ['before', 'after'] : []);
  const beforeAfterRows = entries
    .filter(([field, value]) => !reservedTopLevelKeys.has(field) && hasBeforeAfter(value))
    .map(([field, value]) => ({
      field,
      before: (value as { before?: unknown }).before,
      after: (value as { after?: unknown }).after,
    }));
  const flatRows = entries.filter(
    ([field, value]) => !reservedTopLevelKeys.has(field) && !hasBeforeAfter(value) && isSimpleValue(value),
  );
  const unknownRows = entries.filter(
    ([field, value]) => !reservedTopLevelKeys.has(field) && !hasBeforeAfter(value) && !isSimpleValue(value),
  );

  if (topLevelDiff.length === 0 && beforeAfterRows.length === 0 && flatRows.length === 0) {
    return (
      <div>
        <div className="admin-muted mb-1 text-[11px] uppercase tracking-[0.06em]">JSON</div>
        <ChangeValue value={changes} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topLevelDiff.length > 0 && (
        <div>
          <div className="admin-muted mb-1 text-[11px] uppercase tracking-[0.06em]">Vorher / Nachher</div>
          <DiffRowsTable rows={topLevelDiff} />
        </div>
      )}

      {beforeAfterRows.length > 0 && (
        <div>
          <div className="admin-muted mb-1 text-[11px] uppercase tracking-[0.06em]">Feld-Diffs</div>
          <DiffRowsTable rows={beforeAfterRows} />
        </div>
      )}

      {flatRows.length > 0 && (
        <div>
          <div className="admin-muted mb-1 text-[11px] uppercase tracking-[0.06em]">Geänderte Felder</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {flatRows.map(([field, value]) => (
              <div
                key={field}
                className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2"
              >
                <div className="mb-1 font-medium text-[color:var(--admin-ink-2)]">{field}</div>
                <ChangeValue value={value} />
              </div>
            ))}
          </div>
        </div>
      )}

      {unknownRows.length > 0 && (
        <details className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2">
          <summary className="cursor-pointer text-[12px] font-medium text-[color:var(--admin-ink-2)]">
            Weitere JSON-Struktur ({unknownRows.length})
          </summary>
          <div className="mt-2 space-y-2">
            {unknownRows.map(([field, value]) => (
              <div key={field}>
                <div className="admin-muted mb-1 text-[11px]">{field}</div>
                <ChangeValue value={value} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function AdministratorAuditLogPage() {
  const [items, setItems] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [endpointSource, setEndpointSource] = useState('');
  const [draftFilters, setDraftFilters] = useState<AuditLogFilter>(() => emptyFilters());
  const [filters, setFilters] = useState<AuditLogFilter>(() => emptyFilters());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / limit)) : 0;
  const canLoadNext = totalPages > 0 ? page < totalPages : items.length === limit;
  const canLoadPrev = page > 1;

  const activeFilters = useMemo(() => {
    return Object.entries(filters).filter(([, value]) => compact(value).length > 0);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const userId = compact(filters.user_id);
      const response = await getAuditLog({
        action: compact(filters.action) || undefined,
        entity_type: compact(filters.entity_type) || undefined,
        user_id: userId ? Number(userId) : undefined,
        date_from: compact(filters.date_from) || undefined,
        date_to: compact(filters.date_to) || undefined,
        page,
        limit,
      });

      setItems(response.entries ?? []);
      setTotal(response.total ?? null);
      setEndpointSource(response.source);
      setExpanded({});
    } catch (err) {
      setItems([]);
      setTotal(0);
      setEndpointSource('');
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    const userId = compact(draftFilters.user_id);
    if (userId && !/^\d+$/.test(userId)) {
      setError('Nutzer-ID muss numerisch sein.');
      return;
    }
    setError('');
    setPage(1);
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    const next = emptyFilters();
    setDraftFilters(next);
    setFilters(next);
    setPage(1);
    setError('');
  };

  return (
    <>
      <AdminPageHeader
        title="Änderungshistorie"
        subtitle="Nachvollziehen, welche Admin-Aktion welche Daten geändert hat."
        meta={
          <>
            <span className="admin-live-dot" />
            <span>{loading ? 'lädt' : 'live'}</span>
          </>
        }
      />

      <AdminCard
        className="mb-4"
        title="Filter"
        subtitle="Serverseitige Paginierung. Leere Felder werden ignoriert."
        actions={endpointSource ? <AdminBadge tone="info">{endpointSource}</AdminBadge> : null}
        padded
      >
        {endpointSource === 'audlog-endpoint-unavailable' && (
          <div className="mb-3 rounded-[var(--admin-r-md)] border border-[color:var(--admin-warn-soft)] bg-[color:var(--admin-warn-soft)] px-3 py-2 text-[12.5px] text-[color:var(--admin-warn-ink)]">
            Die Änderungshistorie ist in dieser Umgebung nicht verfügbar.
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-5">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Aktion
            <input
              value={draftFilters.action}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, action: event.target.value }))}
              placeholder="approve, update, delete"
              className="admin-input mt-1"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Bereich
            <input
              value={draftFilters.entity_type}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, entity_type: event.target.value }))}
              placeholder="product, user_product"
              className="admin-input mt-1"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Nutzer-ID
            <input
              value={draftFilters.user_id}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, user_id: event.target.value }))}
              inputMode="numeric"
              className="admin-input mt-1"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Von
            <input
              type="date"
              value={draftFilters.date_from}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, date_from: event.target.value }))}
              className="admin-input mt-1"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Bis
            <input
              type="date"
              value={draftFilters.date_to}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, date_to: event.target.value }))}
              className="admin-input mt-1"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <AdminButton variant="primary" onClick={applyFilters}>
            <Search size={14} />
            Anwenden
          </AdminButton>
          <AdminButton onClick={clearFilters}>
            <X size={14} />
            Zurücksetzen
          </AdminButton>
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />
            Aktualisieren
          </AdminButton>
          <label className="ml-auto min-w-[120px] text-xs font-medium text-[color:var(--admin-ink-2)]">
            Pro Seite
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="admin-select mt-1"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--admin-ink-3)]">
          <span>
            Seite {page}
            {totalPages ? ` / ${totalPages}` : ''} - {total ?? 0} Treffer
          </span>
          {activeFilters.map(([key, value]) => (
            <AdminBadge key={key}>{key}: {value}</AdminBadge>
          ))}
        </div>
      </AdminCard>

      {error && <AdminError>{error}</AdminError>}

      <AdminCard
        title="Ereignisse"
        subtitle="Details zeigen, was geändert wurde und warum."
        actions={
          <div className="flex gap-2">
            <AdminButton
              size="sm"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={!canLoadPrev || loading}
            >
              Vorherige
            </AdminButton>
            <AdminButton
              size="sm"
              onClick={() => setPage((previous) => previous + 1)}
              disabled={!canLoadNext || loading}
            >
              Nächste
            </AdminButton>
          </div>
        }
      >
        {loading && <div className="admin-empty">Lade Änderungshistorie...</div>}

        {!loading && items.length === 0 && <AdminEmpty>Keine Änderungen gefunden.</AdminEmpty>}

        {!loading && items.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Aktion</th>
                  <th>Bereich</th>
                  <th>Nutzer</th>
                  <th>ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const isExpanded = Boolean(expanded[entry.id]);
                  const detailsAvailable = hasDetails(entry);
                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap admin-mono">{formatDate(entry.created_at)}</td>
                      <td>
                        <AdminBadge tone={actionTone(entry.action)}>{entry.action || '-'}</AdminBadge>
                      </td>
                      <td>{entry.entity_type || '-'}</td>
                      <td>
                        <div className="text-[12.5px]">
                          <div>{entry.user_email || '-'}</div>
                          {entry.user_id != null && <div className="admin-muted admin-mono">#{entry.user_id}</div>}
                        </div>
                      </td>
                      <td className="admin-mono">{entry.entity_id ?? '-'}</td>
                      <td className="min-w-[240px]">
                        {detailsAvailable ? (
                          <AdminButton
                            size="sm"
                            onClick={() =>
                              setExpanded((previous) => ({
                                ...previous,
                                [entry.id]: !previous[entry.id],
                              }))
                            }
                          >
                            <History size={13} />
                            {isExpanded ? 'Einklappen' : 'Anzeigen'}
                          </AdminButton>
                        ) : (
                          <span className="admin-muted text-xs">ohne Details</span>
                        )}

                        {isExpanded && (
                          <div className="mt-2 rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-xs">
                            {entry.changes && (
                              <div>
                                <div className="admin-muted mb-2 text-[11px] uppercase tracking-[0.06em]">Änderungen</div>
                                <ChangesRenderer changes={entry.changes} />
                              </div>
                            )}
                            {entry.reason && (
                              <div className="mt-2">
                                <div className="admin-muted">Grund</div>
                                <div className="font-mono">{entry.reason}</div>
                              </div>
                            )}
                            {(entry.ip_address || entry.user_agent) && (
                              <div className="mt-2">
                                <div className="admin-muted">Anfrage</div>
                                {entry.ip_address && <div className="font-mono">IP: {entry.ip_address}</div>}
                                {entry.user_agent && <div className="break-words font-mono">UA: {entry.user_agent}</div>}
                              </div>
                            )}
                          </div>
                        )}
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
