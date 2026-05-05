import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Info, Loader2, Search, XCircle, ZoomIn } from 'lucide-react';
import { getAuditLog, type AdminAuditLogEntry } from '../../api/admin';

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return parsed.toLocaleString('de-DE');
}

function formatChanges(changes?: Record<string, unknown> | null): string {
  if (!changes) return '-';
  try {
    return JSON.stringify(changes);
  } catch {
    return '-';
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
  return 'Die Anfrage ist fehlgeschlagen.';
}

function getFilterValue(value: string): string {
  const next = value.trim();
  return next.length ? next : '';
}

interface AuditLogFilter {
  action: string;
  entity_type: string;
  user_id: string;
  date_from: string;
  date_to: string;
}

interface FilterEntry {
  id: string;
  label: string;
  value: string;
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

export default function AuditLogTab() {
  const [items, setItems] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [endpointSource, setEndpointSource] = useState('');

  const [draftFilters, setDraftFilters] = useState<AuditLogFilter>({
    action: '',
    entity_type: '',
    user_id: '',
    date_from: '',
    date_to: '',
  });
  const [filters, setFilters] = useState<AuditLogFilter>(draftFilters);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / limit)) : 0;
  const canLoadNext = totalPages > 0 ? page < totalPages : rowCount === limit;
  const canLoadPrev = page > 1;

  const activeFilterLabels = useMemo<FilterEntry[]>(() => {
    const entries: FilterEntry[] = [];
    if (filters.action) entries.push({ id: 'action', label: 'action', value: filters.action });
    if (filters.entity_type) entries.push({ id: 'entity', label: 'entity', value: filters.entity_type });
    if (filters.user_id) entries.push({ id: 'user', label: 'user_id', value: filters.user_id });
    if (filters.date_from) entries.push({ id: 'from', label: 'von', value: filters.date_from });
    if (filters.date_to) entries.push({ id: 'to', label: 'bis', value: filters.date_to });
    return entries;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setIsUnavailable(false);
    try {
      const userId = getFilterValue(filters.user_id);
      const response = await getAuditLog({
        action: getFilterValue(filters.action),
        entity_type: getFilterValue(filters.entity_type),
        user_id: userId ? Number(userId) : undefined,
        date_from: getFilterValue(filters.date_from),
        date_to: getFilterValue(filters.date_to),
        page,
        limit,
      });

      setItems(response.entries ?? []);
      setTotal(response.total ?? null);
      setEndpointSource(response.source);
      setIsUnavailable(response.source === 'audlog-endpoint-unavailable');
      setRowCount(response.entries.length);
    } catch (err) {
      setError(getErrorMessage(err));
      setItems([]);
      setTotal(0);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    const userId = getFilterValue(draftFilters.user_id);
    if (userId && !/^\d+$/.test(userId)) {
      setError('user_id muss numerisch sein.');
      return;
    }

    setError('');
    setFilters(draftFilters);
    setPage(1);
  };

  const clearFilters = () => {
    const empty = { action: '', entity_type: '', user_id: '', date_from: '', date_to: '' };
    setDraftFilters(empty);
    setFilters(empty);
    setPage(1);
  };

  const hasFilters = activeFilterLabels.length > 0;
  const selectedTotalText = hasFilters ? activeFilterLabels.map((entry) => `${entry.label}:${entry.value}`).join(' · ') : 'keine Filter';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Audit-Log</h2>
            <p className="text-sm text-gray-600 mt-1">
              Änderungen, Freigaben und Admin-Aktionen sind hier filterbar einsehbar.
            </p>
          </div>
          {endpointSource && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Info size={16} />
              Quelle: {endpointSource}
            </span>
          )}
        </div>

        {isUnavailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Audit-Log-Endpoint ist in dieser Umgebung nicht verfügbar. Die Ansicht ist leer.
          </div>
        )}

        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Aktion
            <input
              value={draftFilters.action}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="z. B. create_ingredient"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Entity-Typ
            <input
              value={draftFilters.entity_type}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, entity_type: event.target.value }))}
              placeholder="z. B. ingredient"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            User-ID
            <input
              value={draftFilters.user_id}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, user_id: event.target.value }))}
              placeholder="z. B. 123"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              inputMode="numeric"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Von
            <input
              type="date"
              value={draftFilters.date_from}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, date_from: event.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Bis
            <input
              type="date"
              value={draftFilters.date_to}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, date_to: event.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700"
          >
            <Search size={16} />
            Anwenden
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filter zuruecksetzen
          </button>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Pro Seite
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            >
              {LIMIT_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
          <span>{`Seite ${page}${totalPages ? ` / ${totalPages}` : ''} · ${hasFilters ? selectedTotalText : 'ungefiltert'} · ${total ?? 0} Treffer`}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={!canLoadPrev || loading}
              className="min-h-11 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50"
            >
              Vorherige
            </button>
            <button
              type="button"
              onClick={() => setPage((previous) => previous + 1)}
              disabled={!canLoadNext || loading}
              className="min-h-11 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50"
            >
              Naechste
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Lade Audit-Log...
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="rounded-xl border border-gray-100 bg-white p-8 text-sm text-gray-500 shadow-sm text-center">
          Keine Eintraege gefunden.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Zeit</th>
                  <th className="py-2 px-3">Aktion</th>
                  <th className="py-2 px-3">Entity</th>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">ID</th>
                  <th className="py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const isExpanded = Boolean(expanded[entry.id]);
                  const hasChanges = Boolean(entry.changes);
                  const hasDetails = Boolean(
                    hasChanges || entry.reason?.trim() || entry.ip_address || entry.user_agent,
                  );
                  return (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2 px-3 whitespace-nowrap text-xs text-gray-600">{formatDate(entry.created_at)}</td>
                      <td className="py-2 px-3 font-medium text-gray-900">{entry.action || '-'}</td>
                      <td className="py-2 px-3">{entry.entity_type || '-'}</td>
                      <td className="py-2 px-3">
                        <div className="text-xs">
                          <div>{entry.user_email || '-'}</div>
                          {entry.user_id != null ? <div className="text-gray-500">ID {entry.user_id}</div> : null}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">{entry.entity_id == null ? '-' : entry.entity_id}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((previous) => ({
                                  ...previous,
                                  [entry.id]: !previous[entry.id],
                                }))
                              }
                              className="min-h-10 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
                            >
                              <ZoomIn size={14} />
                              {isExpanded ? 'Weniger' : 'Details'}
                            </button>
                          ) : null}
                          {!hasDetails ? (
                            <span className="text-xs text-gray-500">ohne Details</span>
                          ) : null}
                        </div>
                        {isExpanded ? (
                          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
                            {hasChanges ? (
                              <div className="mb-2 overflow-x-auto">
                                <div className="text-gray-500 mb-1">changes:</div>
                                <pre className="whitespace-pre-wrap break-words font-mono">
                                  {formatChanges(entry.changes)}
                                </pre>
                              </div>
                            ) : null}
                            {entry.reason ? (
                              <div className="mb-2">
                                <div className="text-gray-500 mb-1">reason:</div>
                                <div className="font-mono break-words">{entry.reason}</div>
                              </div>
                            ) : null}
                            {entry.ip_address || entry.user_agent ? (
                              <div>
                                <div className="text-gray-500 mb-1">request metadata:</div>
                                {entry.ip_address ? (
                                  <div className="font-mono break-words">{`IP: ${entry.ip_address}`}</div>
                                ) : null}
                                {entry.user_agent ? (
                                  <div className="font-mono break-words">{`User-Agent: ${entry.user_agent}`}</div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rowCount >= limit && totalPages === 0 ? (
            <div className="text-xs text-gray-500 px-3 py-2 border-t bg-gray-50">
              Mehr Resultate moeglich — Seitenzahl wird vom Server nachgeladen.
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 flex items-start gap-2">
        <History size={16} />
        Audit-Log nutzt serverseitige Paginierung. Bei fehlender Filterung werden neue Events nachfolgend angezeigt.
      </div>
    </div>
  );
}
