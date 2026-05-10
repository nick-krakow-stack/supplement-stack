import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

type HealthStatus = 'ok' | 'warning' | 'critical' | 'unknown' | 'info' | string;
type HealthSeverity = 'info' | 'warning' | 'critical' | string;

interface AdminHealthSummary {
  status: HealthStatus;
  ok_count: number;
  warning_count: number;
  critical_count: number;
}

interface AdminHealthMetric {
  id: string;
  label: string;
  value: string | number;
  status: HealthStatus;
  href?: string;
}

interface AdminHealthCheck {
  id: string;
  title: string;
  status: HealthStatus;
  severity: HealthSeverity;
  details: string;
  action?: string;
  href?: string;
  observed_count?: number;
}

interface AdminHealthSection {
  id: string;
  title: string;
  checks: AdminHealthCheck[];
}

interface AdminHealthResponse {
  generated_at: string;
  summary: AdminHealthSummary;
  metrics: AdminHealthMetric[];
  sections: AdminHealthSection[];
}

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE').format(value ?? 0);
}

function formatValue(value: string | number): string {
  return typeof value === 'number' ? formatCount(value) : value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'noch nicht geladen';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('de-DE');
}

function statusTone(status: HealthStatus): AdminTone {
  if (status === 'ok') return 'ok';
  if (status === 'critical' || status === 'danger') return 'danger';
  if (status === 'warning' || status === 'unknown') return 'warn';
  if (status === 'info') return 'info';
  return 'neutral';
}

function severityTone(severity: HealthSeverity): AdminTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warn';
  if (severity === 'info') return 'info';
  return 'neutral';
}

function statusLabel(status: HealthStatus): string {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Warnung';
  if (status === 'critical' || status === 'danger') return 'Kritisch';
  if (status === 'unknown') return 'Unklar';
  if (status === 'info') return 'Info';
  return status || 'Unbekannt';
}

function severityLabel(severity: HealthSeverity): string {
  if (severity === 'critical') return 'kritisch';
  if (severity === 'warning') return 'wichtig';
  if (severity === 'info') return 'info';
  return severity || 'neutral';
}

function statusIcon(status: HealthStatus) {
  if (status === 'ok') return <CheckCircle2 size={16} />;
  if (status === 'critical' || status === 'danger') return <XCircle size={16} />;
  if (status === 'unknown') return <HelpCircle size={16} />;
  return <AlertTriangle size={16} />;
}

function HealthLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith('/administrator')) {
    return (
      <Link className="admin-btn admin-btn-sm" to={href}>
        {children}
      </Link>
    );
  }

  return (
    <a className="admin-btn admin-btn-sm" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {children}
      {href.startsWith('http') ? <ExternalLink size={12} /> : null}
    </a>
  );
}

async function getAdminHealth(): Promise<AdminHealthResponse> {
  const response = await apiClient.get<AdminHealthResponse>('/admin/health');
  return response.data;
}

function HealthCheckRow({ check }: { check: AdminHealthCheck }) {
  return (
    <div className="border-b border-[color:var(--admin-line)] px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-start gap-3">
        <span className="admin-muted mt-0.5">{statusIcon(check.status)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium">{check.title}</p>
            <AdminBadge tone={statusTone(check.status)}>{statusLabel(check.status)}</AdminBadge>
            <AdminBadge tone={severityTone(check.severity)}>{severityLabel(check.severity)}</AdminBadge>
          </div>
          <p className="admin-muted mt-1 text-[12.5px] leading-relaxed">{check.details}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.8px] text-[color:var(--admin-ink-3)]">
            {typeof check.observed_count === 'number' && <span className="admin-mono">count={formatCount(check.observed_count)}</span>}
            {check.action && <span>{check.action}</span>}
            {check.href && <HealthLink href={check.href}>Oeffnen</HealthLink>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthSectionCard({ section }: { section: AdminHealthSection }) {
  const okCount = section.checks.filter((check) => check.status === 'ok').length;
  const warningCount = section.checks.filter((check) => check.status === 'warning' || check.status === 'unknown').length;
  const criticalCount = section.checks.filter((check) => check.status === 'critical' || check.status === 'danger').length;

  return (
    <AdminCard
      title={section.title}
      subtitle={`${formatCount(okCount)}/${formatCount(section.checks.length)} Checks OK`}
      actions={
        <div className="flex flex-wrap gap-2">
          <AdminBadge tone="ok">{formatCount(okCount)} ok</AdminBadge>
          {warningCount > 0 && <AdminBadge tone="warn">{formatCount(warningCount)} Warnung</AdminBadge>}
          {criticalCount > 0 && <AdminBadge tone="danger">{formatCount(criticalCount)} kritisch</AdminBadge>}
        </div>
      }
    >
      {section.checks.length > 0 ? (
        <div>
          {section.checks.map((check) => (
            <HealthCheckRow key={check.id} check={check} />
          ))}
        </div>
      ) : (
        <AdminEmpty>Keine Checks in diesem Abschnitt.</AdminEmpty>
      )}
    </AdminCard>
  );
}

export default function AdministratorHealthPage() {
  const [data, setData] = useState<AdminHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextData = await getAdminHealth();
      setData(nextData);
      setLoadedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summaryCards = useMemo(() => {
    const summary = data?.summary;
    return [
      { label: 'OK', value: formatCount(summary?.ok_count), delta: 'bestandene Checks', tone: 'ok' as const },
      {
        label: 'Warnungen',
        value: formatCount(summary?.warning_count),
        delta: 'muss geprüft werden',
        tone: (summary?.warning_count ?? 0) > 0 ? ('warn' as const) : ('ok' as const),
      },
      {
        label: 'Kritisch',
        value: formatCount(summary?.critical_count),
        delta: 'blockierende Risiken',
        tone: (summary?.critical_count ?? 0) > 0 ? ('danger' as const) : ('ok' as const),
      },
      {
        label: 'Status',
        value: summary ? statusLabel(summary.status) : '-',
        delta: data ? `Snapshot ${formatDate(data.generated_at)}` : 'kein Snapshot',
        tone: summary ? statusTone(summary.status) : ('neutral' as const),
      },
    ];
  }, [data]);

  return (
    <>
      <AdminPageHeader
        title="Health"
        subtitle="Status prüfen und offene Aufgaben sehen."
        meta={
          <div className="admin-toolbar-inline items-center">
            <span className="admin-live-dot" />
            <span>{loading ? 'lädt' : data ? 'live' : 'offline'}</span>
            <AdminButton size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} />
              Aktualisieren
            </AdminButton>
          </div>
        }
      />

      {error && (
        <AdminError>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <AdminButton size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} />
              Retry
            </AdminButton>
          </div>
        </AdminError>
      )}

      <div className="admin-health-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className="admin-health-card" data-tone={card.tone}>
            <div className="admin-health-label">{card.label}</div>
            <div className="admin-health-value">{loading && !data ? '...' : card.value}</div>
            <div className="admin-health-delta">{card.delta}</div>
          </div>
        ))}
      </div>

      {data && (
        <AdminCard
          className="mb-4"
          title="Systemstatus"
          subtitle={`Generiert: ${formatDate(data.generated_at)} - geladen: ${formatDate(loadedAt)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <AdminBadge tone={statusTone(data.summary.status)}>{statusLabel(data.summary.status)}</AdminBadge>
              <AdminBadge tone="ok">{formatCount(data.summary.ok_count)} ok</AdminBadge>
              <AdminBadge tone="warn">{formatCount(data.summary.warning_count)} Warnung</AdminBadge>
              <AdminBadge tone="danger">{formatCount(data.summary.critical_count)} kritisch</AdminBadge>
            </div>
          }
          padded
        >
          <div className="admin-muted text-[12.5px]">
            Datenquelle: interne Systemprüfung.
          </div>
        </AdminCard>
      )}

      {loading && !data && <AdminEmpty>Lade Systemstatus...</AdminEmpty>}

      {!loading && !data && !error && <AdminEmpty>Kein Systemstatus verfügbar.</AdminEmpty>}

      {data && data.metrics.length > 0 && (
        <div className="admin-health-grid">
          {data.metrics.map((metric) => (
            <div key={metric.id} className="admin-health-card" data-tone={statusTone(metric.status)}>
              <div className="admin-health-label">{metric.label}</div>
              <div className="admin-health-value">{formatValue(metric.value)}</div>
              <div className="admin-health-delta">
                <span>{statusLabel(metric.status)}</span>
                {metric.href && (
                  <>
                    <span> - </span>
                    <HealthLink href={metric.href}>Details</HealthLink>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.sections.length > 0 ? (
            data.sections.map((section) => <HealthSectionCard key={section.id} section={section} />)
          ) : (
            <AdminEmpty>Keine Systemprüfungen verfügbar.</AdminEmpty>
          )}
        </div>
      )}
    </>
  );
}
