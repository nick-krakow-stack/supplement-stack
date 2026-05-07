import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe2,
  HelpCircle,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  getLaunchChecks,
  type AdminLaunchCheck,
  type AdminLaunchCheckSection,
  type AdminLaunchCheckSeverity,
  type AdminLaunchCheckStatus,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE').format(value ?? 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'noch nicht geladen';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('de-DE');
}

function statusTone(status: AdminLaunchCheckStatus): AdminTone {
  if (status === 'ok') return 'ok';
  if (status === 'danger') return 'danger';
  if (status === 'warning' || status === 'unknown') return 'warn';
  return 'info';
}

function severityTone(severity: AdminLaunchCheckSeverity): AdminTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warn';
  return 'info';
}

function statusLabel(status: AdminLaunchCheckStatus): string {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Prüfen';
  if (status === 'danger') return 'Blocker';
  if (status === 'unknown') return 'Unklar';
  return 'Hinweis';
}

function severityLabel(severity: AdminLaunchCheckSeverity): string {
  if (severity === 'critical') return 'kritisch';
  if (severity === 'warning') return 'wichtig';
  return 'info';
}

function sectionIcon(sectionId: string) {
  if (sectionId === 'database') return <Database size={17} />;
  if (sectionId === 'environment') return <ServerCog size={17} />;
  if (sectionId === 'domain') return <Globe2 size={17} />;
  return <ShieldCheck size={17} />;
}

function statusIcon(status: AdminLaunchCheckStatus) {
  if (status === 'ok') return <CheckCircle2 size={16} />;
  if (status === 'danger') return <XCircle size={16} />;
  if (status === 'unknown') return <HelpCircle size={16} />;
  if (status === 'info') return <Clock size={16} />;
  return <AlertTriangle size={16} />;
}

function CheckRow({ check }: { check: AdminLaunchCheck }) {
  const configuredText =
    typeof check.configured === 'boolean' ? (check.configured ? 'konfiguriert' : 'nicht konfiguriert') : null;

  return (
    <div className="border-b border-[color:var(--admin-line)] px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-start gap-3">
        <span className="admin-muted mt-0.5">
          {statusIcon(check.status)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium">{check.title}</p>
            <AdminBadge tone={statusTone(check.status)}>{statusLabel(check.status)}</AdminBadge>
            <AdminBadge tone={severityTone(check.severity)}>{severityLabel(check.severity)}</AdminBadge>
            <AdminBadge tone="neutral">{check.source}</AdminBadge>
          </div>
          <p className="admin-muted mt-1 text-[12.5px] leading-relaxed">{check.details}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.8px] text-[color:var(--admin-ink-3)]">
            {typeof check.observed_count === 'number' && (
              <span className="admin-mono">count={formatCount(check.observed_count)}</span>
            )}
            {configuredText && <span>{configuredText}</span>}
            {check.action && <span>{check.action}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaunchSectionCard({ section }: { section: AdminLaunchCheckSection }) {
  const okCount = section.checks.filter((check) => check.status === 'ok').length;
  const dangerCount = section.checks.filter((check) => check.status === 'danger').length;
  const attentionCount = section.checks.filter((check) => check.status === 'warning' || check.status === 'unknown').length;

  return (
    <AdminCard
      title={
        <span className="flex items-center gap-2">
          <span className="admin-muted">{sectionIcon(section.id)}</span>
          <span>{section.title}</span>
        </span>
      }
      subtitle={`${okCount}/${section.checks.length} live als OK`}
      actions={
        <div className="flex flex-wrap gap-2">
          <AdminBadge tone="ok">{okCount} ok</AdminBadge>
          {attentionCount > 0 && <AdminBadge tone="warn">{attentionCount} prüfen</AdminBadge>}
          {dangerCount > 0 && <AdminBadge tone="danger">{dangerCount} Blocker</AdminBadge>}
        </div>
      }
    >
      <div>
        {section.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>
    </AdminCard>
  );
}

export default function AdministratorLaunchChecksPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getLaunchChecks>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getLaunchChecks());
    } catch (err) {
      setData(null);
      setError(
        err instanceof Error
          ? `Launch-Checks Endpoint nicht erreichbar: ${err.message}`
          : 'Launch-Checks Endpoint nicht erreichbar.',
      );
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
      {
        label: 'OK',
        value: formatCount(summary?.by_status.ok),
        detail: 'automatisch bestanden',
        tone: 'ok' as const,
      },
      {
        label: 'Prüfen',
        value: formatCount((summary?.by_status.warning ?? 0) + (summary?.by_status.unknown ?? 0)),
        detail: 'offene Live- oder DNS-Signale',
        tone: (summary?.needs_attention ?? 0) > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Blocker',
        value: formatCount(summary?.blocking),
        detail: 'kritische Fehlkonfigurationen',
        tone: (summary?.blocking ?? 0) > 0 ? 'danger' : 'ok',
      },
      {
        label: 'Gesamt',
        value: formatCount(summary?.total),
        detail: data ? `Snapshot ${formatDate(data.generated_at)}` : 'kein Snapshot',
        tone: 'info' as const,
      },
    ];
  }, [data]);

  return (
    <>
      <AdminPageHeader
        title="Go-Live-Checks"
        subtitle="Prüft Datenbank, offene Aufgaben, Konfiguration und Domain. Geheimwerte werden nicht angezeigt."
        meta={
          <div className="admin-toolbar-inline items-center">
            <span className="admin-live-dot" />
            <span>{loading ? 'laedt' : data ? 'live' : 'offline'}</span>
            <AdminButton size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} />
              Aktualisieren
            </AdminButton>
          </div>
        }
      />

      {error && <AdminError>{error}</AdminError>}

      <div className="admin-health-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className="admin-health-card" data-tone={card.tone}>
            <div className="admin-health-label">{card.label}</div>
            <div className="admin-health-value">{loading ? '...' : card.value}</div>
            <div className="admin-health-delta">{card.detail}</div>
          </div>
        ))}
      </div>

      {loading && <AdminEmpty>Lade Go-Live-Prüfungen...</AdminEmpty>}

      {!loading && !data && !error && <AdminEmpty>Keine Go-Live-Prüfung verfügbar.</AdminEmpty>}

      {data && (
        <>
          <AdminCard
            className="mb-4"
            title={`Stand für ${data.domain}`}
            subtitle={`Aktualisiert: ${formatDate(data.generated_at)}. Sichtbar nur im Admin-Bereich.`}
            actions={
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone="danger">{formatCount(data.summary.by_severity.critical)} kritisch</AdminBadge>
                <AdminBadge tone="warn">{formatCount(data.summary.by_severity.warning)} wichtig</AdminBadge>
                <AdminBadge tone="info">{formatCount(data.summary.by_severity.info)} info</AdminBadge>
              </div>
            }
            padded
          >
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--admin-ink-3)]">
              <AlertTriangle size={15} />
              <span>Konfigurationswerte werden nicht ausgegeben.</span>
              <span>-</span>
              <span>Manuelle Rechts-, Mail- und Backup-Freigaben bleiben explizit markiert.</span>
            </div>
          </AdminCard>

          <div className="space-y-4">
            {data.sections.map((section) => (
              <LaunchSectionCard key={section.id} section={section} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
