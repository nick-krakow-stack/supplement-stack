import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  Download,
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
    </div>
  );
}
