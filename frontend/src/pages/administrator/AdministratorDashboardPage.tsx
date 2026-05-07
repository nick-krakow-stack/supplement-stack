import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Database, History, RefreshCw } from 'lucide-react';
import { getAdminStats, getOpsDashboard, type AdminOpsDashboard } from '../../api/admin';
import type { AdminStats } from '../../types';
import { AdminBadge, AdminButton, AdminCard, AdminError, AdminPageHeader } from './AdminUi';

function formatCount(value: number | undefined, fallback = 0): string {
  return new Intl.NumberFormat('de-DE').format(value ?? fallback);
}

export default function AdministratorDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({});
  const [ops, setOps] = useState<AdminOpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextOps] = await Promise.all([getAdminStats(), getOpsDashboard().catch(() => null)]);
      setStats(nextStats);
      setOps(nextOps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'Wirkstoffe',
        value: formatCount(stats.ingredients),
        delta: `${formatCount(ops?.research.due_reviews)} Pr\u00fcfungen f\u00e4llig`,
        tone: ops?.research.due_reviews ? 'warn' : 'ok',
      },
      {
        label: 'Produkte',
        value: formatCount(stats.products_total ?? stats.products),
        delta: `${formatCount(stats.products_pending ?? stats.pending_products)} warten auf Pr\u00fcfung`,
        tone: (stats.products_pending ?? stats.pending_products ?? 0) > 0 ? 'info' : 'ok',
      },
      {
        label: 'Nutzer-Stacks',
        value: formatCount(stats.stacks),
        delta: `${formatCount(stats.users)} Nutzerkonten`,
        tone: 'info',
      },
      {
        label: 'Offene Aufgaben',
        value: formatCount((ops?.product_qa.issues ?? 0) + (ops?.link_reports.open ?? 0)),
        delta: `${formatCount(ops?.link_reports.open)} Linkmeldungen \u00b7 ${formatCount(ops?.product_qa.issues)} Produktpr\u00fcfungen`,
        tone: (ops?.link_reports.open ?? 0) > 0 ? 'warn' : 'ok',
      },
    ] as const,
    [ops, stats],
  );

  const activity = [
    {
      who: 'Produkte',
      what: 'Produktdaten pr\u00fcfen und fehlende Angaben erg\u00e4nzen',
      when: 'laufend',
      entity: 'Katalog',
    },
    {
      who: 'Links',
      what: 'Gemeldete Kauf-Links ansehen und abschlie\u00dfen',
      when: 'laufend',
      entity: 'Meldungen',
    },
    {
      who: 'Wirkstoffe',
      what: 'Quellen, Dosierungen und Warnhinweise vollst\u00e4ndig halten',
      when: 'laufend',
      entity: 'Quellen',
    },
  ];

  const tasks = [
    {
      tone: 'warn' as const,
      label: 'Offene Linkmeldungen pr\u00fcfen',
      action: 'Linkmeldungen',
      href: '/administrator/link-reports',
    },
    {
      tone: 'info' as const,
      label: 'Produkte mit fehlenden Bildern oder Packungsdaten korrigieren',
      action: 'Produktpr\u00fcfung',
      href: '/administrator/product-qa',
    },
    {
      tone: 'info' as const,
      label: 'Wirkstoffquellen und Dosiswerte vervollst\u00e4ndigen',
      action: 'Dosierungen',
      href: '/administrator/dosing',
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        subtitle={'Schneller \u00dcberblick \u00fcber Katalog, Wirkstoffe, Linkmeldungen und offene Pr\u00fcfungen.'}
        meta={
          <>
            <span className="admin-live-dot" />
            <span>{loading ? 'l\u00e4dt' : 'live'}</span>
          </>
        }
      />

      {error && <AdminError>{error}</AdminError>}

      <div className="admin-health-grid">
        {cards.map((card) => (
          <div key={card.label} className="admin-health-card" data-tone={card.tone}>
            <div className="admin-health-label">{card.label}</div>
            <div className="admin-health-value">{loading ? '...' : card.value}</div>
            <div className="admin-health-delta">{card.delta}</div>
          </div>
        ))}
      </div>

      <div className="admin-row-2">
        <AdminCard
          title="Was passiert gerade"
          subtitle={'Wichtige Bereiche, die regelm\u00e4\u00dfig gepflegt werden sollten'}
          actions={
            <AdminButton size="sm">
              <History size={13} />
              Audit-Log
            </AdminButton>
          }
        >
          <div>
            {activity.map((entry) => (
              <div
                key={`${entry.who}-${entry.entity}`}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-[color:var(--admin-line)] px-5 py-3 last:border-b-0"
              >
                <div>
                  <div className="text-[13px]">{entry.what}</div>
                  <div className="admin-muted admin-mono mt-0.5 text-[11.5px]">
                    {entry.who} {'\u00b7'} {entry.entity}
                  </div>
                </div>
                <span className="admin-muted whitespace-nowrap text-xs">{entry.when}</span>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard
          title="Top-Aufgaben"
          subtitle={'Die wichtigsten n\u00e4chsten Schritte f\u00fcr einen sauberen Katalog'}
          actions={<Database size={16} className="admin-muted" />}
        >
          <div>
            {tasks.map((task) => (
              <div
                key={task.label}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[color:var(--admin-line)] px-5 py-3 last:border-b-0"
              >
                <AdminBadge tone={task.tone}>{task.tone === 'warn' ? 'wichtig' : 'offen'}</AdminBadge>
                <span className="text-[13px]">{task.label}</span>
                <a className="admin-btn admin-btn-sm" href={task.href}>
                  {task.action}
                  <ChevronRight size={12} />
                </a>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="mt-5">
        <AdminButton onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />
          Aktualisieren
        </AdminButton>
      </div>
    </>
  );
}
