import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Download,
  Flag,
  FileText,
  PackageSearch,
  RefreshCw,
} from 'lucide-react';
import {
  getIngredientResearchExport,
  getOpsDashboard,
  isEndpointMissingError,
  type AdminOpsDashboard,
} from '../../api/admin';

interface OpsCard {
  label: string;
  value: number;
  tone: string;
  icon: React.ReactNode;
  href?: string;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'kein Datum';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function issueLabel(issue: string): string {
  const labels: Record<string, string> = {
    missing_image: 'Bild fehlt',
    missing_shop_link: 'Shop-Link fehlt',
    missing_serving_data: 'Portionsdaten fehlen',
    suspicious_price_zero_or_high: 'Preis auffaellig',
    missing_ingredient_rows: 'Wirkstoffzeilen fehlen',
    no_affiliate_flag_on_shop_link: 'Affiliate-Flag fehlt',
  };
  return labels[issue] ?? issue.replace(/[_-]+/g, ' ');
}

function reportReasonLabel(reason: string): string {
  return reason === 'invalid_link' ? 'Link fehlerhaft' : 'Link fehlt';
}

interface QueuePanelProps {
  title: string;
  tone: string;
  children: React.ReactNode;
}

function QueuePanel({ title, tone, children }: QueuePanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`border-b border-slate-100 px-4 py-3 text-sm font-semibold ${tone}`}>
        {title}
      </div>
      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </section>
  );
}

function EmptyQueue() {
  return <p className="px-4 py-5 text-sm text-slate-500">Keine offenen Eintraege.</p>;
}

export default function AdminOpsDashboardTab() {
  const [dashboard, setDashboard] = useState<AdminOpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getOpsDashboard()
      .then((data) => {
        if (alive) setDashboard(data);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Admin-Übersicht konnte nicht geladen werden.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleExport = async () => {
    setExportStatus('Lade Export...');
    try {
      const data = await getIngredientResearchExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setExportStatus('Export geöffnet.');
    } catch (err) {
      if (isEndpointMissingError(err)) {
        setExportStatus('Export ist in dieser Umgebung nicht verfügbar.');
        return;
      }
      setExportStatus('Export konnte nicht geöffnet werden.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!dashboard) return null;

  const cards: OpsCard[] = [
    {
      label: 'Recherche fällig',
      value: dashboard.research.due_reviews,
      tone: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: <RefreshCw size={19} />,
      href: '/admin?tab=ingredient_research',
    },
    {
      label: 'Ungeprüft',
      value: dashboard.research.unreviewed,
      tone: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: <ClipboardList size={19} />,
      href: '/admin?tab=ingredient_research',
    },
    {
      label: 'In Recherche',
      value: dashboard.research.researching,
      tone: 'bg-sky-50 text-sky-700 border-sky-100',
      icon: <ClipboardList size={19} />,
      href: '/admin?tab=ingredient_research',
    },
    {
      label: 'Veraltet',
      value: dashboard.research.stale,
      tone: 'bg-orange-50 text-orange-700 border-orange-100',
      icon: <AlertTriangle size={19} />,
      href: '/admin?tab=ingredient_research',
    },
    {
      label: 'Wissens-Entwürfe',
      value: dashboard.knowledge.drafts,
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      icon: <FileText size={19} />,
      href: '/admin?tab=knowledge_articles',
    },
    {
      label: 'Warnungen ohne Artikel',
      value: dashboard.warnings.without_article,
      tone: 'bg-red-50 text-red-700 border-red-100',
      icon: <AlertTriangle size={19} />,
      href: '/admin?tab=ingredient_research',
    },
    {
      label: 'Produkt-QA Issues',
      value: dashboard.product_qa.issues,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      icon: <PackageSearch size={19} />,
      href: '/admin?tab=product_qa',
    },
    {
      label: 'Linkmeldungen',
      value: dashboard.link_reports.open,
      tone: 'bg-rose-50 text-rose-700 border-rose-100',
      icon: <Flag size={19} />,
      href: '/admin?tab=link_reports',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Admin-Übersicht</h2>
          <p className="text-sm text-slate-500">Offene Recherche-, Wissens- und Produktdaten-Prüfungen.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download size={16} />
            Recherche-JSON
          </button>
          {exportStatus && <span className="text-xs text-slate-500">{exportStatus}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${card.tone}`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-tight text-slate-950">{formatCount(card.value)}</p>
                <p className="text-sm text-slate-500">{card.label}</p>
              </div>
            </>
          );

          if (card.href) {
            return (
              <Link
                key={card.label}
                to={card.href}
                className="flex min-h-[96px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={card.label} className="flex min-h-[96px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {content}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <QueuePanel title="Heute bearbeiten" tone="text-amber-800 bg-amber-50/80">
          {dashboard.queues.product_qa.length === 0 &&
            dashboard.queues.link_reports.length === 0 &&
            dashboard.queues.research_due.length === 0 &&
            dashboard.queues.warnings_without_article.length === 0 ? (
              <EmptyQueue />
            ) : (
              <>
                {dashboard.queues.link_reports.map((report) => (
                  <Link
                    key={`link-report-${report.id}`}
                    to={`/admin?tab=link_reports&q=${encodeURIComponent(report.product_name || String(report.product_id))}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {report.product_name || `Produkt ${report.product_id}`}
                      </p>
                      <p className="text-xs text-slate-500">{reportReasonLabel(report.reason)} · {report.user_email || 'User unbekannt'}</p>
                    </div>
                    <ArrowRight className="mt-0.5 shrink-0 text-slate-400" size={16} />
                  </Link>
                ))}
                {dashboard.queues.product_qa.map((product) => (
                  <Link
                    key={`product-${product.id}`}
                    to={`/admin?tab=product_qa&q=${encodeURIComponent(product.name)}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">#{product.id} {product.name}</p>
                      <p className="text-xs text-slate-500">{product.brand || 'Ohne Marke'} · {product.issues.slice(0, 2).map(issueLabel).join(', ')}</p>
                    </div>
                    <ArrowRight className="mt-0.5 shrink-0 text-slate-400" size={16} />
                  </Link>
                ))}
                {dashboard.queues.research_due.map((item) => (
                  <Link
                    key={`research-due-${item.ingredient_id}`}
                    to={`/admin?tab=ingredient_research&q=${encodeURIComponent(item.ingredient_name)}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.ingredient_name}</p>
                      <p className="text-xs text-slate-500">Review faellig: {formatDate(item.review_due_at)}</p>
                    </div>
                    <ArrowRight className="mt-0.5 shrink-0 text-slate-400" size={16} />
                  </Link>
                ))}
                {dashboard.queues.warnings_without_article.map((warning) => (
                  <Link
                    key={`warning-${warning.id}`}
                    to="/admin?tab=ingredient_research"
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{warning.short_label || 'Warnung ohne Artikel'}</p>
                      <p className="text-xs text-slate-500">
                        {[warning.ingredient_name, warning.form_name, warning.article_slug || 'Artikel-Slug fehlt'].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 shrink-0 text-slate-400" size={16} />
                  </Link>
                ))}
              </>
            )}
        </QueuePanel>

        <QueuePanel title="Spaeter einplanen" tone="text-slate-800 bg-slate-50">
          {dashboard.queues.knowledge_drafts.length === 0 && dashboard.queues.research_later.length === 0 ? (
            <EmptyQueue />
          ) : (
            <>
              {dashboard.queues.knowledge_drafts.map((article) => (
                <Link
                  key={`draft-${article.slug}`}
                  to={`/admin?tab=knowledge_articles&q=${encodeURIComponent(article.slug)}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{article.title}</p>
                    <p className="text-xs text-slate-500">Entwurf · aktualisiert {formatDate(article.updated_at)}</p>
                  </div>
                  <ArrowRight className="mt-0.5 shrink-0 text-slate-400" size={16} />
                </Link>
              ))}
              {dashboard.queues.research_later.map((item) => (
                <Link
                  key={`research-later-${item.ingredient_id}`}
                  to={`/admin?tab=ingredient_research&q=${encodeURIComponent(item.ingredient_name)}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.ingredient_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.research_status === 'stale' ? 'Veraltet' : 'Ungeprueft'} · Review {formatDate(item.review_due_at)}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 shrink-0 text-slate-400" size={16} />
                </Link>
              ))}
            </>
          )}
        </QueuePanel>
      </div>
    </div>
  );
}
