import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Link2,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { getAdminStats, getOpsDashboard, type AdminOpsDashboard } from '../../api/admin';
import type { AdminStats, AdminStatsTrend } from '../../types';
import { AdminCard, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

const RANGE_OPTIONS = [
  { value: '30d', label: '30 Tage' },
  { value: '60d', label: '60 Tage' },
  { value: '1y', label: '1 Jahr' },
  { value: 'this_month', label: 'Dieser Monat' },
  { value: 'last_month', label: 'Letzter Monat' },
  { value: 'all', label: 'Gesamt' },
] as const;

type DashboardRange = (typeof RANGE_OPTIONS)[number]['value'];

type DashboardTask = {
  id: string;
  label: string;
  value: number;
  meta: string;
  href: string;
  action: string;
  tone: AdminTone;
};

type DashboardSignal = {
  label: string;
  value: string;
  meta: string;
  href: string;
  tone: AdminTone;
};

type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  href: string;
  tone: AdminTone;
};

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE').format(numberValue(value));
}

function formatPercent(numerator: number | null | undefined, denominator: number | null | undefined): string {
  const base = numberValue(denominator);
  if (base <= 0) return '0 %';
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format((numberValue(numerator) / base) * 100)} %`;
}

function normalizeTrend(current: number, trend?: AdminStatsTrend): AdminStatsTrend {
  if (trend) return trend;
  return {
    current,
    previous: 0,
    delta: current,
    delta_percent: null,
  };
}

function formatTrend(trend: AdminStatsTrend, range: DashboardRange): string {
  if (range === 'all') return 'kein Vorzeitraum';
  if (trend.previous <= 0) return trend.current > 0 ? 'neu im Zeitraum' : 'keine Veränderung';
  const prefix = trend.delta > 0 ? '+' : '';
  const percent = trend.delta_percent === null
    ? ''
    : ` (${prefix}${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(trend.delta_percent)} %)`;
  return `${prefix}${formatCount(trend.delta)} zum Vorzeitraum${percent}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'fällig';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

function inactiveRangeLabel(range: DashboardRange): string {
  if (range === '60d') return '60 Tage';
  if (range === '1y') return '1 Jahr';
  if (range === 'this_month') return 'diesen Monat';
  if (range === 'last_month') return 'letzten Monat';
  if (range === 'all') return 'den gewählten Zeitraum';
  return '30 Tage';
}

function taskTone(value: number, urgentTone: AdminTone = 'warn'): AdminTone {
  return value > 0 ? urgentTone : 'ok';
}

export default function AdministratorDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({});
  const [ops, setOps] = useState<AdminOpsDashboard | null>(null);
  const [range, setRange] = useState<DashboardRange>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextOps] = await Promise.all([getAdminStats(range), getOpsDashboard().catch(() => null)]);
      setStats(nextStats);
      setOps(nextOps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const linkClicks = numberValue(stats.link_clicks);
  const affiliateClicks = numberValue(stats.affiliate_link_clicks);
  const deadlinks = numberValue(stats.deadlinks);
  const deadlinkClicks = numberValue(stats.deadlink_clicks);
  const openLinkReports = numberValue(stats.open_link_reports ?? ops?.link_reports.open);
  const pendingProducts = numberValue(stats.products_pending ?? stats.pending_products);
  const pendingApprovals = numberValue(stats.user_products_pending ?? pendingProducts);
  const pendingApprovalsInRange = numberValue(stats.user_products_pending_in_range ?? pendingApprovals);
  const productQaIssues = numberValue(ops?.product_qa.issues);
  const dueResearch = numberValue(ops?.research.due_reviews);
  const ingredientsWithoutArticle = numberValue(stats.ingredients_without_article ?? ops?.warnings.without_article);
  const knowledgeDrafts = numberValue(ops?.knowledge.drafts);
  const nonAffiliateClicks = numberValue(stats.non_affiliate_link_clicks);
  const clickedWithoutActiveLink = numberValue(stats.products_clicked_without_active_link);
  const stackEmailSends = numberValue(stats.stack_email_sends);
  const accountDeletions = numberValue(stats.account_deletions);
  const inactiveUsers = numberValue(stats.inactive_users);
  const backlinks = numberValue(stats.backlinks);
  const googlePageviews = numberValue(stats.google_pageviews);
  const userAffiliateLinksActive = numberValue(stats.user_affiliate_links_active);
  const linkReportUsers = numberValue(stats.link_report_users);

  const tasks = useMemo<DashboardTask[]>(
    () => [
      {
        id: 'deadlinks',
        label: 'Deadlinks',
        value: deadlinks,
        meta: `${formatCount(stats.deadlinks_over_7_days)} seit mehr als 7 Tagen`,
        href: '/administrator/products?link_status=dead',
        action: 'Prüfen',
        tone: taskTone(deadlinks, 'danger'),
      },
      {
        id: 'link-reports',
        label: 'Offene Linkmeldungen',
        value: openLinkReports,
        meta: 'von Nutzern gemeldet',
        href: '/administrator/link-reports',
        action: 'Abarbeiten',
        tone: taskTone(openLinkReports, 'warn'),
      },
      {
        id: 'product-qa',
        label: 'Produktfreigaben / Produkt-QA',
        value: pendingApprovals + productQaIssues,
        meta: `${formatCount(pendingApprovals)} offene Freigaben, ${formatCount(productQaIssues)} QA-Hinweise`,
        href: '/administrator/user-products?status=pending',
        action: 'Katalog',
        tone: taskTone(pendingApprovals + productQaIssues, 'warn'),
      },
      {
        id: 'research-due',
        label: 'Fällige Wirkstoffprüfungen',
        value: dueResearch,
        meta: 'Review-Datum erreicht',
        href: '/administrator/ingredients',
        action: 'Wirkstoffe',
        tone: taskTone(dueResearch, 'warn'),
      },
      {
        id: 'warnings',
        label: 'Wirkstoffe ohne Artikel',
        value: ingredientsWithoutArticle,
        meta: 'Wissenslücke',
        href: '/administrator/ingredients?task=knowledge',
        action: 'Pflegen',
        tone: taskTone(ingredientsWithoutArticle, 'danger'),
      },
      {
        id: 'knowledge',
        label: 'Wissens-Entwürfe',
        value: knowledgeDrafts,
        meta: 'noch nicht publiziert',
        href: '/administrator/knowledge?status=draft',
        action: 'Bearbeiten',
        tone: taskTone(knowledgeDrafts, 'info'),
      },
    ],
    [
      deadlinks,
      dueResearch,
      knowledgeDrafts,
      openLinkReports,
      pendingApprovals,
      productQaIssues,
      stats.deadlinks_over_7_days,
      ingredientsWithoutArticle,
    ],
  );

  const signals = useMemo<DashboardSignal[]>(
    () => [
      {
        label: 'Link-Klicks',
        value: formatCount(linkClicks),
        meta: formatTrend(normalizeTrend(linkClicks, stats.trends?.link_clicks), range),
        href: '/administrator/products',
        tone: linkClicks > 0 ? 'ok' : 'neutral',
      },
      {
        label: 'Affiliate-Klicks',
        value: formatCount(affiliateClicks),
        meta: formatTrend(normalizeTrend(affiliateClicks, stats.trends?.affiliate_link_clicks), range),
        href: '/administrator/products?affiliate=partner',
        tone: affiliateClicks > 0 ? 'ok' : 'neutral',
      },
      {
        label: 'Affiliate-Quote',
        value: formatPercent(affiliateClicks, linkClicks),
        meta: `${formatCount(nonAffiliateClicks)} Klicks ohne Affiliate`,
        href: '/administrator/products?affiliate=no_partner',
        tone: linkClicks > 0 && affiliateClicks === 0 ? 'warn' : 'info',
      },
      {
        label: 'Deadlinks',
        value: formatCount(deadlinks),
        meta: `${formatCount(deadlinkClicks)} Deadlinks wurden geklickt`,
        href: '/administrator/products?link_status=dead',
        tone: deadlinks > 0 ? 'danger' : 'ok',
      },
      {
        label: 'Offene Linkmeldungen',
        value: formatCount(openLinkReports),
        meta: 'Support- und Katalogsignal',
        href: '/administrator/link-reports',
        tone: openLinkReports > 0 ? 'warn' : 'ok',
      },
    ],
    [
      affiliateClicks,
      deadlinks,
      deadlinkClicks,
      linkClicks,
      nonAffiliateClicks,
      openLinkReports,
      range,
      stats.trends?.affiliate_link_clicks,
      stats.trends?.link_clicks,
    ],
  );

  const metrics = useMemo<DashboardMetric[]>(
    () => [
      {
        label: 'Neuanmeldungen',
        value: formatCount(stats.registrations),
        delta: `davon ${formatCount(stats.activated_users)} aktiv`,
        href: '/administrator/users',
        tone: numberValue(stats.registrations) > 0 ? 'info' : 'neutral',
      },
      {
        label: 'Neue Stacks',
        value: formatCount(stats.stacks_in_range),
        delta: `${formatCount(stackEmailSends)} Stacks wurden verschickt`,
        href: '/administrator/users',
        tone: numberValue(stats.stacks_in_range) > 0 ? 'ok' : 'neutral',
      },
      {
        label: 'Backlinks',
        value: formatCount(backlinks),
        delta: `${formatCount(googlePageviews)} Aufrufe über Google`,
        href: '/administrator/dashboard',
        tone: backlinks > 0 ? 'ok' : 'neutral',
      },
      {
        label: 'Abmeldungen',
        value: formatCount(accountDeletions),
        delta: `${formatCount(inactiveUsers)} seit mehr als ${inactiveRangeLabel(range)} inaktiv`,
        href: '/administrator/users',
        tone: accountDeletions > 0 ? 'warn' : 'neutral',
      },
    ],
    [
      accountDeletions,
      backlinks,
      googlePageviews,
      inactiveUsers,
      range,
      stats.activated_users,
      stats.registrations,
      stats.stacks_in_range,
      stackEmailSends,
    ],
  );

  const activity = [
    ...(ops?.queues.link_reports ?? []).slice(0, 2).map((entry) => ({
      id: `link-${entry.id}`,
      title: entry.product_name ?? 'Produktlink',
      meta: `Linkmeldung - ${entry.reason}`,
      value: entry.created_at ? formatDate(entry.created_at) : 'offen',
      href: '/administrator/link-reports',
    })),
    ...(ops?.queues.product_qa ?? []).slice(0, 2).map((entry) => ({
      id: `product-${entry.id}`,
      title: `${entry.name}${entry.brand ? ` (${entry.brand})` : ''}`,
      meta: 'Produktpflege',
      value: `${entry.issues.length} Hinweise`,
      href: `/administrator/products?q=${encodeURIComponent(entry.name)}`,
    })),
    ...(ops?.queues.research_due ?? []).slice(0, 2).map((entry) => ({
      id: `research-${entry.ingredient_id}`,
      title: entry.ingredient_name,
      meta: 'Quellenprüfung',
      value: formatDate(entry.review_due_at),
      href: `/administrator/ingredients/${entry.ingredient_id}`,
    })),
    ...(ops?.queues.warnings_without_article ?? []).slice(0, 1).map((entry) => ({
      id: `warning-${entry.id}`,
      title: entry.short_label ?? entry.ingredient_name ?? 'Warnung',
      meta: 'Artikel fehlt',
      value: entry.severity ?? 'offen',
      href: '/administrator/ingredients?task=knowledge',
    })),
  ].slice(0, 6);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Was heute Aufmerksamkeit braucht."
        meta={
          <>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as DashboardRange)}
              className="admin-select admin-meta-select"
              aria-label="Dashboard-Zeitraum"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="admin-meta-icon-btn"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Dashboard aktualisieren"
              title="Aktualisieren"
            >
              <RefreshCw size={14} />
            </button>
            <span className="admin-live-dot" />
            <span>{loading ? 'lädt' : 'live'}</span>
          </>
        }
      />

      {error && <AdminError>{error}</AdminError>}

      <div className="admin-dashboard-primary">
        <AdminCard
          title="Heute zu tun"
          subtitle="Die wichtigsten offenen Punkte zuerst."
          actions={<ClipboardCheck size={16} className="admin-muted" />}
          className="admin-today-card"
        >
          <div className="admin-today-list">
            {tasks.map((task, index) => (
              <a key={task.id} href={task.href} className="admin-today-item" data-tone={task.tone}>
                <span className="admin-today-rank">{index + 1}</span>
                <span className="admin-today-main">
                  <span className="admin-today-title">{task.label}</span>
                  <span className="admin-today-meta">{task.meta}</span>
                </span>
                <strong className="admin-today-value">{loading ? '...' : formatCount(task.value)}</strong>
                <span className="admin-btn admin-btn-sm">
                  {task.action}
                  <ChevronRight size={12} />
                </span>
              </a>
            ))}
          </div>
        </AdminCard>

        <AdminCard
          title="Umsatzsignale"
          subtitle="Welche Links gerade Leistung zeigen."
          actions={<BarChart3 size={16} className="admin-muted" />}
          className="admin-revenue-card"
        >
          <div className="admin-signal-list">
            {signals.map((signal) => (
              <a key={signal.label} href={signal.href} className="admin-signal-item" data-tone={signal.tone}>
                <span>
                  <span className="admin-signal-label">{signal.label}</span>
                  <span className="admin-signal-meta">{signal.meta}</span>
                </span>
                <strong>{loading ? '...' : signal.value}</strong>
              </a>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="admin-health-grid admin-dashboard-kpis">
        {metrics.map((card) => (
          <a key={card.label} href={card.href} className="admin-health-card admin-health-card-link" data-tone={card.tone}>
            <div className="admin-health-label">{card.label}</div>
            <div className="admin-health-value">{loading ? '...' : card.value}</div>
            <div className="admin-health-delta">{card.delta}</div>
          </a>
        ))}
      </div>

      <div className="admin-dashboard-modules">
        <AdminCard
          title="Katalogpflege"
          subtitle="Produkte und Links sauber halten."
          actions={<Wrench size={16} className="admin-muted" />}
          className="admin-dashboard-module"
        >
          <div className="admin-module-stats">
            <a href="/administrator/products?link_status=dead" className="admin-module-stat" data-tone={deadlinks > 0 ? 'danger' : 'ok'}>
              <AlertTriangle size={15} />
              <span>Deadlinks</span>
              <strong>{formatCount(deadlinks)}</strong>
            </a>
            <a href="/administrator/user-products?status=pending" className="admin-module-stat" data-tone={pendingApprovalsInRange > 0 ? 'warn' : 'ok'}>
              <PackageCheck size={15} />
              <span>offene Freigaben</span>
              <strong>{formatCount(pendingApprovalsInRange)}</strong>
            </a>
            <a href="/administrator/products" className="admin-module-stat" data-tone={clickedWithoutActiveLink > 0 ? 'warn' : 'neutral'}>
              <Link2 size={15} />
              <span>Ohne Affiliate-Link</span>
              <strong>{formatCount(clickedWithoutActiveLink)}</strong>
            </a>
          </div>
          <div className="admin-top-list">
            {(stats.top_clicked_products ?? []).length > 0 ? (
              stats.top_clicked_products?.map((product) => (
                <a key={product.product_id} href={`/administrator/products?q=${encodeURIComponent(product.name)}`} className="admin-top-item">
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.brand ?? 'Katalogprodukt'}</small>
                  </span>
                  <span>{formatCount(product.clicks)} Klicks</span>
                </a>
              ))
            ) : (
              <a href="/administrator/products?affiliate=user" className="admin-top-item">
                <span>
                  <strong>{formatCount(userAffiliateLinksActive)} fremde Affiliate-Links aktiv</strong>
                  <small>Nach User-Link filtern</small>
                </span>
                <span>Prüfen</span>
              </a>
            )}
          </div>
        </AdminCard>

        <AdminCard
          title="Content & Vertrauen"
          subtitle="Quellen, Warnungen und Wissen pflegen."
          actions={<ShieldAlert size={16} className="admin-muted" />}
          className="admin-dashboard-module"
        >
          <div className="admin-module-stats">
            <a href="/administrator/ingredients" className="admin-module-stat" data-tone={dueResearch > 0 ? 'warn' : 'ok'}>
              <CheckCircle2 size={15} />
              <span>Reviews fällig</span>
              <strong>{formatCount(dueResearch)}</strong>
            </a>
            <a href="/administrator/ingredients?task=knowledge" className="admin-module-stat" data-tone={ingredientsWithoutArticle > 0 ? 'danger' : 'ok'}>
              <ShieldAlert size={15} />
              <span>Wirkstoffe ohne Artikel</span>
              <strong>{formatCount(ingredientsWithoutArticle)}</strong>
            </a>
            <a href="/administrator/knowledge?status=draft" className="admin-module-stat" data-tone={knowledgeDrafts > 0 ? 'info' : 'neutral'}>
              <BookOpen size={15} />
              <span>Entwürfe</span>
              <strong>{formatCount(knowledgeDrafts)}</strong>
            </a>
          </div>
          <div className="admin-top-list">
            {(stats.top_shops ?? []).length > 0 ? (
              stats.top_shops?.map((shop) => (
                <a key={shop.shop} href="/administrator/shop-domains" className="admin-top-item">
                  <span>
                    <strong>{shop.shop}</strong>
                    <small>{formatCount(shop.affiliate_clicks)} Affiliate-Klicks</small>
                  </span>
                  <span>{formatCount(shop.clicks)} Klicks</span>
                </a>
              ))
            ) : (
              <a href="/administrator/link-reports" className="admin-top-item">
                <span>
                  <strong>{formatCount(linkReportUsers)} User haben Scam-Links eingereicht</strong>
                  <small>Linkmeldungen nach Nutzer prüfen</small>
                </span>
                <span>Öffnen</span>
              </a>
            )}
          </div>
        </AdminCard>

        <AdminCard
          title="Was passiert gerade"
          subtitle="Neue Meldungen und offene Prüfungen."
          actions={<TrendingUp size={16} className="admin-muted" />}
          className="admin-activity-card admin-dashboard-activity"
        >
          <div className="admin-activity-list">
            {activity.length > 0 ? activity.map((entry) => (
              <a key={entry.id} href={entry.href} className="admin-activity-item">
                <div>
                  <div className="admin-activity-title">{entry.title}</div>
                  <div className="admin-activity-meta">{entry.meta}</div>
                </div>
                <span className="admin-activity-time">{entry.value}</span>
              </a>
            )) : (
              <div className="admin-activity-empty">Keine akuten Warteschlangen.</div>
            )}
          </div>
        </AdminCard>
      </div>
    </>
  );
}
