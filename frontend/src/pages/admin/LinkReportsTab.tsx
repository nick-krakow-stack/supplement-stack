import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Flag, RefreshCw } from 'lucide-react';
import {
  getProductLinkReports,
  updateProductLinkReportStatus,
  type AdminProductLinkReport,
  type AdminProductLinkReportStatus,
} from '../../api/admin';

const statusOptions: Array<{ value: AdminProductLinkReportStatus | ''; label: string }> = [
  { value: 'open', label: 'Offen' },
  { value: 'reviewed', label: 'Geprueft' },
  { value: 'closed', label: 'Erledigt' },
  { value: '', label: 'Alle' },
];

function formatDate(value: string | null): string {
  if (!value) return 'kein Datum';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function reasonLabel(reason: string): string {
  return reason === 'invalid_link' ? 'Link fehlerhaft' : 'Link fehlt';
}

function statusLabel(status: AdminProductLinkReportStatus): string {
  if (status === 'closed') return 'Erledigt';
  if (status === 'reviewed') return 'Geprueft';
  return 'Offen';
}

function statusClass(status: AdminProductLinkReportStatus): string {
  if (status === 'closed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'reviewed') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

function linkHost(value: string | null): string {
  if (!value) return 'kein Link';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || value;
  }
}

export default function LinkReportsTab() {
  const [reports, setReports] = useState<AdminProductLinkReport[]>([]);
  const [status, setStatus] = useState<AdminProductLinkReportStatus | ''>('open');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const openCount = useMemo(() => reports.filter((report) => report.status === 'open').length, [reports]);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProductLinkReports({ status, q: query, limit: 150 });
      setReports(data.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Linkmeldungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const updateStatus = async (report: AdminProductLinkReport, nextStatus: AdminProductLinkReportStatus) => {
    setSavingId(report.id);
    setError('');
    try {
      const updated = await updateProductLinkReportStatus(report.id, nextStatus);
      setReports((prev) => prev.map((item) => (item.id === report.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status konnte nicht gespeichert werden.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Linkmeldungen</h2>
          <p className="text-sm text-slate-500">
            Nutzer melden hier fehlende oder fehlerhafte Kauf-Links. Produkte ohne Kauf-Link sollten korrigiert und nicht ignoriert werden.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          <Flag size={16} />
          {openCount} offen in dieser Ansicht
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void loadReports();
          }}
          placeholder="Produkt, Nutzer, Stack oder URL suchen"
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as AdminProductLinkReportStatus | '')}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        >
          {statusOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadReports()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <RefreshCw size={16} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Keine Linkmeldungen in dieser Ansicht.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {reports.map((report) => (
            <section key={report.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(report.status)}`}>
                      {statusLabel(report.status)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {reasonLabel(report.reason)}
                    </span>
                    <span className="text-xs text-slate-500">#{report.id} · {formatDate(report.created_at)}</span>
                  </div>
                  <div>
                    <h3 className="truncate text-base font-semibold text-slate-950">
                      {report.product_name || `Produkt ${report.product_id}`}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {report.product_type === 'user_product' ? 'User-Produkt' : 'Katalogprodukt'} #{report.product_id}
                      {report.stack_name ? ` · Stack: ${report.stack_name}` : ''}
                      {report.user_email ? ` · ${report.user_email}` : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-400">Gemeldeter Link</p>
                      <p className="mt-1 break-all font-medium text-slate-700">{linkHost(report.shop_link_snapshot)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-400">Aktueller Link</p>
                      <p className="mt-1 break-all font-medium text-slate-700">{linkHost(report.current_shop_link)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  {report.current_shop_link && (
                    <a
                      href={report.current_shop_link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink size={15} />
                      Link oeffnen
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={savingId === report.id}
                    onClick={() => void updateStatus(report, report.status === 'closed' ? 'open' : 'closed')}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {report.status === 'closed' ? 'Wieder oeffnen' : 'Als erledigt markieren'}
                  </button>
                  {report.status === 'open' && (
                    <button
                      type="button"
                      disabled={savingId === report.id}
                      onClick={() => void updateStatus(report, 'reviewed')}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Geprueft, offen lassen
                    </button>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
