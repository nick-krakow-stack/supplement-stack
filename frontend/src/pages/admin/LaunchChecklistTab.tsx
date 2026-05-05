import { AlertTriangle, CheckCircle2, MailCheck, MonitorCheck, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChecklistItem {
  title: string;
  status: 'ok' | 'manual' | 'missing';
  details: string;
  action?: string;
}

const mailItems: ChecklistItem[] = [
  {
    title: 'SPF',
    status: 'ok',
    details: 'Aktuell gefunden: v=spf1 a mx include:spf.kasserver.com ~all',
  },
  {
    title: 'MX',
    status: 'ok',
    details: 'Aktuell gefunden: 10 w020a88d.kasserver.com.',
  },
  {
    title: 'DMARC',
    status: 'ok',
    details: 'Aktuell gesetzt: v=DMARC1; p=none; rua=mailto:email@nickkrakow.de; adkim=s; aspf=s; pct=100',
    action: 'Nach stabiler Zustellung später auf p=quarantine und danach p=reject verschärfen.',
  },
  {
    title: 'DKIM',
    status: 'manual',
    details: 'Kein gängiger DKIM-Selector gefunden. Der korrekte Selector kommt vom Mailanbieter.',
    action: 'Im All-Inkl/Kasserver-Mailbereich DKIM aktivieren und den angezeigten TXT/CNAME Record im DNS setzen.',
  },
];

const trustItems: ChecklistItem[] = [
  {
    title: 'Impressum, Datenschutz, Nutzungsbedingungen',
    status: 'ok',
    details: 'Footer-Links sind global sichtbar. Die Texte decken Betreiber, Datenschutz, Affiliate und medizinische Abgrenzung ab.',
  },
  {
    title: 'Affiliate-Hinweis',
    status: 'ok',
    details: 'Footer, Impressum, Nutzungsbedingungen und Produktbuttons markieren Affiliate-Links transparent.',
  },
  {
    title: 'Health-Claims',
    status: 'manual',
    details: 'Vor Go-Live weiter fachlich prüfen: keine Heilversprechen, keine krankheitsbezogenen Versprechen in Produktkarten, Blog und E-Mails.',
  },
];

const monitoringItems: ChecklistItem[] = [
  {
    title: 'Gemeldete Produktlinks',
    status: 'ok',
    details: 'Neue Meldungen landen im Admin unter "Linkmeldungen" und in der Admin-Übersicht.',
  },
  {
    title: 'Fehlerseiten',
    status: 'ok',
    details: 'Unbekannte App-Routen zeigen eine 404-Seite mit Rückweg zur Startseite.',
  },
  {
    title: 'Cloudflare Logs',
    status: 'manual',
    details: 'Nach Deploy im Cloudflare Dashboard prüfen: Pages Deployment, Functions Logs, 4xx/5xx, Mailversand-Endpunkte.',
  },
  {
    title: 'D1 Backups und Migrationsstand',
    status: 'manual',
    details: 'Vor Go-Live einmal D1 Backup erzeugen, letzte Migration prüfen und Deploy-Log dokumentieren.',
  },
];

function statusBadge(status: ChecklistItem['status']) {
  if (status === 'ok') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }
  if (status === 'missing') {
    return 'border-red-100 bg-red-50 text-red-700';
  }
  return 'border-amber-100 bg-amber-50 text-amber-700';
}

function statusLabel(status: ChecklistItem['status']) {
  if (status === 'ok') return 'OK';
  if (status === 'missing') return 'Fehlt';
  return 'Manuell';
}

function ChecklistSection({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: ChecklistItem[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-slate-700">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.title} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[170px_minmax(0,1fr)]">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(item.status)}`}>
                {statusLabel(item.status)}
              </span>
              <strong className="text-sm text-slate-900">{item.title}</strong>
            </div>
            <div className="min-w-0 text-sm leading-relaxed text-slate-600">
              <p>{item.details}</p>
              {item.action && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                  {item.action}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LaunchChecklistTab() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Go-Live Checks</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
              Technische Startkontrolle für Mailzustellung, Vertrauen/Rechtstexte und Fehlerblick.
              DNS-Einträge müssen beim Domain- oder Mailanbieter gesetzt werden; die App kann sie nur dokumentieren.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            <AlertTriangle size={16} />
            DKIM noch manuell
          </div>
        </div>
      </div>

      <ChecklistSection icon={<MailCheck size={18} />} title="Mail und DNS" items={mailItems} />
      <ChecklistSection icon={<ShieldCheck size={18} />} title="Recht und Vertrauen" items={trustItems} />
      <ChecklistSection icon={<MonitorCheck size={18} />} title="Monitoring und Fehlerblick" items={monitoringItems} />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <CheckCircle2 size={17} />
          Launch-Ablauf
        </div>
        <p>
          Nach DNS-Änderungen mindestens eine echte Registrierung, E-Mail-Verifizierung, Passwort-Reset
          und Stack-Mail an eine externe Adresse testen. Danach Cloudflare Functions Logs prüfen und
          offene Linkmeldungen/Produkt-QA im Admin auf null oder bewusst akzeptiert bringen.
        </p>
      </div>
    </div>
  );
}
