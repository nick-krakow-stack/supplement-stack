import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Flag, RefreshCw, Search } from 'lucide-react';
import {
  getProductLinkReports,
  updateProductLinkReportStatus,
  type AdminProductLinkReport,
  type AdminProductLinkReportStatus,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

const STATUS_OPTIONS: Array<{ value: AdminProductLinkReportStatus | ''; label: string }> = [
  { value: 'open', label: 'Offen' },
  { value: 'reviewed', label: 'Geprüft' },
  { value: 'closed', label: 'Erledigt' },
  { value: '', label: 'Alle' },
];

const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

function statusLabel(status: AdminProductLinkReportStatus): string {
  if (status === 'closed') return 'Erledigt';
  if (status === 'reviewed') return 'Geprüft';
  return 'Offen';
}

function statusTone(status: AdminProductLinkReportStatus): 'danger' | 'warn' | 'ok' {
  if (status === 'open') return 'danger';
  if (status === 'reviewed') return 'warn';
  return 'ok';
}

function reasonLabel(reason: string): string {
  if (reason === 'invalid_link') return 'Link fehlerhaft';
  return 'Link fehlt';
}

function linkHost(value: string | null): string {
  if (!value) return 'kein Link';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || value;
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'kein Datum';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function productLineLabel(report: AdminProductLinkReport): string {
  const base = `${report.product_type === 'user_product' ? 'Nutzer-Produkt' : 'Katalogprodukt'} #${report.product_id}`;
  if (!report.stack_name) return base;
  return `${base} - Stack ${report.stack_name}`;
}

function LinkReportRow({
  report,
  onUpdate,
  onError,
}: {
  report: AdminProductLinkReport;
  onUpdate: (report: AdminProductLinkReport) => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState<AdminProductLinkReportStatus | null>(null);

  const changeStatus = async (nextStatus: AdminProductLinkReportStatus) => {
    if (nextStatus === report.status) return;
    setSaving(nextStatus);
    try {
      const updated = await updateProductLinkReportStatus(report.id, nextStatus);
      onUpdate(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Status konnte nicht gespeichert werden.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <article className="admin-card">
      <div className="admin-card-pad">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[250px] flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <AdminBadge tone={statusTone(report.status)}>{statusLabel(report.status)}</AdminBadge>
              <AdminBadge tone="info">{reasonLabel(report.reason)}</AdminBadge>
              <AdminBadge tone="neutral">{formatDate(report.created_at)}</AdminBadge>
            </div>
            <h3 className="mt-2 text-[16px] font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
              {report.product_name || `Produkt #${report.product_id}`}
            </h3>
            <p className="admin-muted mt-1 text-xs">
              {productLineLabel(report)}
              {report.stack_id ? ` - Stack-ID ${report.stack_id}` : ''}
            </p>
            <p className="admin-muted mt-1 text-xs">
              Reporter: {report.user_email ?? `Nutzer #${report.user_id}`}
            </p>
          </div>

          <div className="grid min-w-[240px] flex-1 gap-2">
            <div className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2">
              <div className="admin-muted mb-1 text-[11px] uppercase">Gemeldeter Link</div>
              <p className="admin-mono text-xs break-all">{linkHost(report.shop_link_snapshot)}</p>
            </div>
            <div className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2">
              <div className="admin-muted mb-1 text-[11px] uppercase">Aktueller Link</div>
              <p className="admin-mono text-xs break-all">{linkHost(report.current_shop_link)}</p>
            </div>
          </div>
        </div>

        <div className="admin-toolbar-inline mt-4">
          {report.current_shop_link && (
            <a
              href={report.current_shop_link}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn"
            >
              <ExternalLink size={13} />
              Aktueller Link
            </a>
          )}
          {(['open', 'reviewed', 'closed'] as const).map((nextStatus) => (
            <AdminButton
              key={nextStatus}
              size="sm"
              variant={report.status === nextStatus ? 'primary' : 'default'}
              onClick={() => void changeStatus(nextStatus)}
              disabled={saving !== null}
            >
              {statusLabel(nextStatus)}
            </AdminButton>
          ))}
          {report.shop_link_snapshot && (
            <a
              href={report.shop_link_snapshot}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn admin-btn-ghost"
            >
              <ExternalLink size={13} />
              Gemeldeten Link
            </a>
          )}
        </div>

        {saving && <p className="admin-muted mt-2 text-[12px]">Speichert Status zu {statusLabel(saving)}...</p>}
      </div>
    </article>
  );
}

export default function AdministratorLinkReportsPage() {
  const [reports, setReports] = useState<AdminProductLinkReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<AdminProductLinkReportStatus | ''>('open');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<AdminProductLinkReportStatus, number>>({
    open: 0,
    reviewed: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProductLinkReports({ status: statusFilter || undefined, q: query, page, limit });
      setReports(data.reports);
      setTotal(data.total);
      setStatusSummary(data.summary.statuses);
    } catch (err) {
      setReports([]);
      setTotal(0);
      setStatusSummary({ open: 0, reviewed: 0, closed: 0 });
      setError(err instanceof Error ? err.message : 'Linkmeldungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [limit, page, query, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canLoadPrevious = page > 1;
  const canLoadNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(total, (page - 1) * limit + reports.length);

  useEffect(() => {
    if (!loading && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, totalPages]);

  const applyQuery = useCallback(() => {
    setPage(1);
    setQuery(queryInput);
  }, [queryInput]);

  const handleStatusUpdate = async (id: number, status: AdminProductLinkReportStatus) => {
    try {
      const updated = await updateProductLinkReportStatus(id, status);
      setReports((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)));
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status konnte nicht gespeichert werden.');
    }
  };

  const updateReport = (updated: AdminProductLinkReport) => {
    setReports((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)));
    void load();
  };

  return (
    <>
      <AdminPageHeader
        title="Linkmeldungen"
        subtitle="Nutzer melden fehlende oder defekte Produkt-Links. Hier kann der Status der Meldung direkt gesetzt werden."
        meta={
          <div className="admin-toolbar-inline">
            <Flag size={14} />
            <AdminBadge tone="danger">{statusSummary.open} offen</AdminBadge>
            <AdminBadge tone="info">{total} Treffer</AdminBadge>
          </div>
        }
      />

      <div className="admin-toolbar">
        <div className="admin-toolbar-inline">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyQuery();
              }}
              placeholder="Produkt, Stack, Nutzer oder Link suchen"
              className="admin-input pl-11"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as AdminProductLinkReportStatus | '');
            }}
            className="admin-select min-w-[180px]"
          >
            {STATUS_OPTIONS.map((entry) => (
              <option key={entry.value || 'all'} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <AdminButton onClick={applyQuery}>
            <Search size={13} />
            Suche
          </AdminButton>
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} />
            Aktualisieren
          </AdminButton>
        </div>

        <div className="admin-toolbar-inline">
          {(['open', 'reviewed', 'closed'] as const).map((status) => (
            <AdminButton
              key={status}
              variant={statusFilter === status ? 'primary' : 'default'}
              onClick={() => {
                setPage(1);
                setStatusFilter(status);
              }}
            >
              {statusLabel(status)} ({statusSummary[status] ?? 0})
            </AdminButton>
          ))}
          <AdminButton
            variant={statusFilter === '' ? 'primary' : 'default'}
            onClick={() => {
              setPage(1);
              setStatusFilter('');
            }}
          >
            Alle ({statusSummary.open + statusSummary.reviewed + statusSummary.closed})
          </AdminButton>
        </div>

        <div className="admin-toolbar-inline">
          <span className="admin-muted text-sm">
            Seite {page} / {totalPages} - {rangeStart}-{rangeEnd} von {total}
          </span>
          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_LIMIT_OPTIONS)[number]);
            }}
            className="admin-select w-[140px]"
            aria-label="Einträge pro Seite"
          >
            {PAGE_LIMIT_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry} / Seite
              </option>
            ))}
          </select>
          <AdminButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canLoadPrevious || loading}>
            <ChevronLeft size={13} />
            Zurück
          </AdminButton>
          <AdminButton onClick={() => setPage((current) => current + 1)} disabled={!canLoadNext || loading}>
            Weiter
            <ChevronRight size={13} />
          </AdminButton>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      {loading && <AdminEmpty>Lade Linkmeldungen...</AdminEmpty>}

      {!loading && reports.length === 0 && (
        <AdminEmpty>Keine Linkmeldungen in dieser Sicht.</AdminEmpty>
      )}

      {!loading && reports.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {reports.map((report) => (
              <LinkReportRow
                key={report.id}
                report={report}
                onUpdate={updateReport}
                onError={(message) => setError(message)}
              />
            ))}
          </div>

          <AdminCard padded className="hidden md:block">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produkt / Kontext</th>
                    <th>Links</th>
                    <th>Meldung</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td className="min-w-[280px]">
                        <div className="font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                          #{report.id} {report.product_name || `Produkt ${report.product_id}`}
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          {productLineLabel(report)}
                          {report.stack_id ? ` - Stack-ID ${report.stack_id}` : ''}
                        </div>
                        <div className="admin-muted mt-1 text-[12px]">
                          Reporter: {report.user_email ?? `Nutzer #${report.user_id}`} - {formatDate(report.created_at)}
                        </div>
                      </td>
                      <td className="min-w-[240px]">
                        <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2 text-xs">
                          <div className="admin-muted mb-1">Gemeldet</div>
                          <div className="admin-mono break-all">{linkHost(report.shop_link_snapshot)}</div>
                        </div>
                        <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2 mt-2 text-xs">
                          <div className="admin-muted mb-1">Aktuell</div>
                          <div className="admin-mono break-all">{linkHost(report.current_shop_link)}</div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          <AdminBadge tone={statusTone(report.status)}>{statusLabel(report.status)}</AdminBadge>
                          <AdminBadge tone="info">{reasonLabel(report.reason)}</AdminBadge>
                        </div>
                        <div className="admin-muted mt-2 text-xs">Grund: {reasonLabel(report.reason)}</div>
                      </td>
                      <td className="min-w-[250px]">
                        <div className="admin-toolbar-inline">
                          {(['open', 'reviewed', 'closed'] as const).map((status) => (
                            <AdminButton
                              key={status}
                              size="sm"
                              variant={report.status === status ? 'primary' : 'default'}
                              onClick={() => {
                                if (report.status === status) return;
                                void handleStatusUpdate(report.id, status);
                              }}
                            >
                              {statusLabel(status)}
                            </AdminButton>
                          ))}
                        </div>
                        {report.current_shop_link && (
                          <a
                            href={report.current_shop_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-btn admin-btn-ghost mt-2"
                          >
                            <ExternalLink size={12} />
                            Link öffnen
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>

          <div className="admin-toolbar mt-3">
            <div className="admin-toolbar-inline justify-end">
              <span className="admin-muted text-sm">
                Seite {page} / {totalPages}
              </span>
              <AdminButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canLoadPrevious || loading}>
                <ChevronLeft size={13} />
                Zurück
              </AdminButton>
              <AdminButton onClick={() => setPage((current) => current + 1)} disabled={!canLoadNext || loading}>
                Weiter
                <ChevronRight size={13} />
              </AdminButton>
            </div>
          </div>
        </>
      )}
    </>
  );
}
