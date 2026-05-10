import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCheck2,
  MailCheck,
  RefreshCw,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { getOpsDashboard, type AdminOpsDashboard } from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

type ReadinessState = 'live' | 'manual' | 'attention' | 'static';

type StatusItem = {
  title: string;
  state: ReadinessState;
  description: string;
  evidence: string;
  href?: string;
  linkLabel?: string;
};

type RelatedLink = {
  label: string;
  href: string;
  description: string;
  tone: AdminTone;
};

function stateTone(state: ReadinessState): AdminTone {
  if (state === 'live') return 'ok';
  if (state === 'attention') return 'warn';
  if (state === 'manual') return 'info';
  return 'neutral';
}

function stateLabel(state: ReadinessState): string {
  if (state === 'live') return 'Live';
  if (state === 'attention') return 'Prüfen';
  if (state === 'manual') return 'Manuell';
  return 'Statisch';
}

function formatCount(value: number | undefined): string {
  return new Intl.NumberFormat('de-DE').format(value ?? 0);
}

function StatusRows({ items }: { items: StatusItem[] }) {
  return (
    <div>
      {items.map((item) => (
        <div
          key={item.title}
          className="grid gap-3 border-b border-[color:var(--admin-line)] px-5 py-4 last:border-b-0 md:grid-cols-[auto_1fr_auto]"
        >
          <AdminBadge tone={stateTone(item.state)}>{stateLabel(item.state)}</AdminBadge>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[color:var(--admin-ink)]">{item.title}</p>
            <p className="admin-muted mt-1 text-[12.5px] leading-relaxed">{item.description}</p>
            <p className="admin-muted admin-mono mt-2 text-[11.5px]">{item.evidence}</p>
          </div>
          {item.href ? (
            <Link className="admin-btn admin-btn-sm self-start whitespace-nowrap" to={item.href}>
              {item.linkLabel ?? 'Oeffnen'}
              <ExternalLink size={12} />
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RelatedSection({ links }: { links: RelatedLink[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-4 text-left no-underline transition hover:border-[color:var(--admin-line-strong)] hover:bg-[color:var(--admin-bg-sunk)]"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[color:var(--admin-ink)]">{link.label}</span>
            <AdminBadge tone={link.tone}>Admin</AdminBadge>
          </div>
          <p className="admin-muted text-[12.5px] leading-relaxed">{link.description}</p>
        </Link>
      ))}
    </div>
  );
}

export default function AdministratorSettingsPage() {
  const [ops, setOps] = useState<AdminOpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setOps(await getOpsDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settings-Status konnte nicht geladen werden.');
      setOps(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openWork = useMemo(
    () =>
      (ops?.research.due_reviews ?? 0) +
      (ops?.product_qa.issues ?? 0) +
      (ops?.link_reports.open ?? 0) +
      (ops?.knowledge.drafts ?? 0) +
      (ops?.warnings.without_article ?? 0),
    [ops],
  );

  const systemItems: StatusItem[] = [
    {
      title: 'Cloudflare Pages / Workers Laufzeit',
      state: 'static',
      description:
        'Frontend und API laufen auf der Cloudflare-Linie. Diese Seite ändert keine Worker-Konfiguration und liest keine Secrets aus.',
      evidence: 'Statisch aus Projektarchitektur: frontend/src, functions/api, wrangler.toml.',
      href: '/administrator/health',
      linkLabel: 'Health',
    },
    {
      title: 'Admin-Route',
      state: 'live',
      description:
        'Der Admin-Bereich ist unter /administrator aktiv. Alte frontendseitige Admin-Pfade wurden entfernt.',
      evidence: 'Routing-Konzept: /administrator ist der einzige Frontend-Admin-Pfad.',
    },
    {
      title: 'Operations-Backlog',
      state: openWork > 0 ? 'attention' : 'live',
      description:
        'Dieser Wert zählt offene Prüfungen, Produktmeldungen, Linkmeldungen, Entwürfe und Warnungen ohne Artikel.',
      evidence: loading ? 'Lade Übersicht ...' : `${formatCount(openWork)} offene Punkte im Admin-Bereich.`,
      href: '/administrator/dashboard',
      linkLabel: 'Dashboard',
    },
  ];

  const securityItems: StatusItem[] = [
    {
      title: 'Admin-Zugriff',
      state: 'static',
      description:
        'Die Shell nutzt den bestehenden AuthContext und Admin-Check. Rollen, Sessions und Einladungen werden hier nur dokumentiert, nicht bearbeitet.',
      evidence: 'Keine neuen Auth-Endpunkte; keine Rollenmutation in dieser Settings-Seite.',
      href: '/administrator/users',
      linkLabel: 'Users',
    },
    {
      title: 'Secrets und Zugangsdaten',
      state: 'manual',
      description:
        'SMTP-Passwort, Tokens und API-Schlüssel dürfen nicht in UI, Memory oder Repo angezeigt werden. Prüfung erfolgt nur im Anbieter-Dashboard.',
      evidence: 'Manuelle Kontrolle in Cloudflare Pages Secrets / Provider-Konsole; keine Secret-Werte im Frontend.',
    },
  ];

  const mailDeploymentItems: StatusItem[] = [
    {
      title: 'Mail / DNS',
      state: 'manual',
      description:
        'SPF, MX, DMARC und DKIM sind Startchecks. Header- und Spam-Tests bleiben manuell, weil die UI keine Live-DNS-Prüfung ausführt.',
      evidence: 'Siehe Go-Live-Checks; kein DNS-Resolver in dieser Seite.',
      href: '/administrator/launch-checks',
      linkLabel: 'Checks',
    },
    {
      title: 'Bereit für Veröffentlichung',
      state: 'manual',
      description:
        'Vor Veröffentlichungen müssen Frontend-Build, Backend-Prüfung, Migrationsstand und Vorschau-/Live-Checks dokumentiert werden.',
      evidence: 'Manueller Veröffentlichungsprozess; diese Seite speichert keine Deploy-Daten.',
      href: '/administrator/health',
      linkLabel: 'Health',
    },
    {
      title: 'Link- und Shop-Konfiguration',
      state: (ops?.link_reports.open ?? 0) > 0 ? 'attention' : 'live',
      description:
        'Shop-Domains werden im Admin gepflegt. Offene Linkmeldungen kommen live aus dem Ops-Dashboard und sollten vor Launch geschlossen werden.',
      evidence: loading ? 'Lade Linkmeldungen ...' : `${formatCount(ops?.link_reports.open)} offene Linkmeldungen.`,
      href: '/administrator/link-reports',
      linkLabel: 'Links',
    },
  ];

  const dataItems: StatusItem[] = [
    {
      title: 'D1 Daten und Migrationen',
      state: 'manual',
      description:
        'Migrationen bleiben Teil des Entwicklungs- und Veröffentlichungsprozesses. Diese Seite zeigt keine Live-Migrationsprüfung.',
      evidence: 'Manuell gegen d1-migrations und Remote-Migration-Log prüfen.',
      href: '/administrator/health',
      linkLabel: 'Health',
    },
    {
      title: 'Backup-Nachweis',
      state: 'manual',
      description:
        'Ein frischer D1-Export muss vor produktiven Eingriffen dokumentiert werden. Die UI fordert keine Credentials an und startet keine Backups.',
      evidence: 'Manuelle Kontrolle in Backup-Workflow / Deploy-Log.',
      href: '/administrator/launch-checks',
      linkLabel: 'Checks',
    },
    {
      title: 'Content-Datenqualitaet',
      state: (ops?.research.due_reviews ?? 0) + (ops?.warnings.without_article ?? 0) > 0 ? 'attention' : 'live',
      description:
        'Quellenprüfungen und Warnungen ohne Artikel kommen aus den offenen Aufgaben. Fachliche Freigabe bleibt ein redaktioneller Schritt.',
      evidence: loading
        ? 'Lade Quellenstatus ...'
        : `${formatCount(ops?.research.due_reviews)} Prüfungen fällig, ${formatCount(ops?.warnings.without_article)} Warnungen ohne Artikel.`,
      href: '/administrator/ingredients',
      linkLabel: 'Wirkstoffe',
    },
  ];

  const relatedLinks: RelatedLink[] = [
    {
      label: 'Health',
      href: '/administrator/health',
      description: 'Offene Aufgaben, Migrationen und Warteschlangen im Überblick.',
      tone: 'info',
    },
    {
      label: 'Go-Live-Checks',
      href: '/administrator/launch-checks',
      description: 'Mail/DNS, Trust, Monitoring, Backup und Rebuild-Checkliste.',
      tone: 'warn',
    },
    {
      label: 'Shop-Domains',
      href: '/administrator/shop-domains',
      description: 'Domain-Regeln für externe Kauf- und Anbieterlinks pflegen.',
      tone: 'info',
    },
    {
      label: 'Linkmeldungen',
      href: '/administrator/link-reports',
      description: 'Gemeldete fehlende oder defekte Produktlinks abarbeiten.',
      tone: 'danger',
    },
    {
      label: 'Wissen',
      href: '/administrator/knowledge',
      description: 'Artikel, Quellen und Warnhinweise redaktionell prüfen.',
      tone: 'neutral',
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Einstellungen"
        subtitle="Wichtige Einstellungen und offene Prüfungen sehen."
        meta={
          <>
            <span className="admin-live-dot" />
            <span>{loading ? 'lädt Ops' : ops ? 'Ops live' : 'statisch'}</span>
          </>
        }
      />

      {error ? <AdminError>{error}</AdminError> : null}

      <div className="admin-health-grid">
        <div className="admin-health-card" data-tone={openWork > 0 ? 'warn' : 'ok'}>
          <div className="admin-health-label">
            <ServerCog size={14} />
            Systemstatus
          </div>
          <div className="admin-health-value">{loading ? '...' : openWork > 0 ? 'Prüfen' : 'OK'}</div>
          <div className="admin-health-delta">{loading ? 'Ops werden geladen' : `${formatCount(openWork)} offene Ops-Punkte`}</div>
        </div>
        <div className="admin-health-card" data-tone="info">
          <div className="admin-health-label">
            <ShieldCheck size={14} />
            Auth
          </div>
          <div className="admin-health-value">Admin</div>
          <div className="admin-health-delta">bestehende Rolle, keine Secret-Anzeige</div>
        </div>
        <div className="admin-health-card" data-tone={(ops?.link_reports.open ?? 0) > 0 ? 'danger' : 'ok'}>
          <div className="admin-health-label">
            <MailCheck size={14} />
            Mail / Links
          </div>
          <div className="admin-health-value">{loading ? '...' : formatCount(ops?.link_reports.open)}</div>
          <div className="admin-health-delta">offene Linkmeldungen, DNS manuell</div>
        </div>
        <div className="admin-health-card" data-tone="warn">
          <div className="admin-health-label">
            <Database size={14} />
            Backup
          </div>
          <div className="admin-health-value">Manuell</div>
          <div className="admin-health-delta">D1 Export vor produktiven Eingriffen</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminButton onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />
          Aktualisieren
        </AdminButton>
        <Link className="admin-btn" to="/administrator/launch-checks">
          <FileCheck2 size={14} />
          Go-Live-Checks
        </Link>
      </div>

      <div className="space-y-4">
        <AdminCard
          title="Environment und Runtime"
          subtitle="Konfigurationsüberblick ohne neue Schreibfunktionen."
          actions={<AdminBadge tone="neutral">statisch + ops</AdminBadge>}
        >
          <StatusRows items={systemItems} />
        </AdminCard>

        <div className="admin-row-2">
          <AdminCard
            title="Security und Auth"
            subtitle="Hinweise für Zugriff, Rollen und Nachvollziehbarkeit."
            actions={<ShieldCheck size={16} className="admin-muted" />}
          >
            <StatusRows items={securityItems} />
          </AdminCard>

          <AdminCard
            title="Mail, DNS und Deployment"
            subtitle="Manuelle Checks klar von Live-Daten getrennt."
            actions={<MailCheck size={16} className="admin-muted" />}
          >
            <StatusRows items={mailDeploymentItems} />
          </AdminCard>
        </div>

        <AdminCard
          title="Daten, Backup und Inhalte"
          subtitle="D1, Migrationen und redaktionelle Datenqualitaet."
          actions={<AdminBadge tone="warn">kein Secret-Zugriff</AdminBadge>}
        >
          <StatusRows items={dataItems} />
        </AdminCard>

        <AdminCard
          title="Verknüpfte Admin-Bereiche"
          subtitle="Konkrete Ziele für die nächsten Schritte."
          actions={<CheckCircle2 size={16} className="admin-muted" />}
          padded
        >
          <RelatedSection links={relatedLinks} />
        </AdminCard>

        <AdminCard
          title="Abgrenzung"
          subtitle="Was diese Settings-Seite bewusst nicht tut."
          actions={<AlertTriangle size={16} className="admin-muted" />}
          padded
        >
          <div className="grid gap-2 text-sm leading-relaxed text-[color:var(--admin-ink-2)] lg:grid-cols-3">
            <p>Keine Anzeige, Abfrage oder Speicherung von Secrets, Passwoertern, Tokens oder DNS-Schluesseln.</p>
            <p>Keine Live-Prüfung für DNS, Backups, Migrationen oder Cloudflare-Veröffentlichungen.</p>
            <p>Diese Seite ist eine Übersicht und verweist auf bestehende Admin-Werkzeuge.</p>
          </div>
        </AdminCard>
      </div>
    </>
  );
}
