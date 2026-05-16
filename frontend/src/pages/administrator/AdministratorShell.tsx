import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import AdministratorCommandPalette from './AdministratorCommandPalette';
import './admin.css';

type NavigationItem = {
  label: string;
  path: string;
  icon: JSX.Element;
  match?: string[];
};

type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const NAV_GROUPS: NavigationGroup[] = [
  {
    title: 'Katalog',
    items: [
      { label: 'Dashboard', path: '/administrator/dashboard', icon: <LayoutDashboard size={15} /> },
      { label: 'Wirkstoffe', path: '/administrator/ingredients', icon: <FlaskConical size={15} /> },
      { label: 'Produkte', path: '/administrator/products', icon: <Package size={15} /> },
      { label: 'Richtwerte', path: '/administrator/dosing', icon: <FlaskConical size={15} /> },
      { label: 'Wissensdatenbank', path: '/administrator/knowledge', icon: <BookOpen size={15} /> },
      { label: 'Übersetzungen', path: '/administrator/translations', icon: <Languages size={15} /> },
    ],
  },
  {
    title: 'Konfiguration',
    items: [
      { label: 'Benutzerverwaltung', path: '/administrator/users', icon: <Users size={15} /> },
      { label: 'Shop-Domains', path: '/administrator/shop-domains', icon: <ExternalLink size={15} /> },
      { label: 'Verwaltung', path: '/administrator/management', icon: <Settings size={15} /> },
      { label: 'Rechtliches', path: '/administrator/legal', icon: <FileText size={15} /> },
    ],
  },
];

const ROUTE_TITLES: Record<string, { group: string; title: string }> = {
  '/administrator/dashboard': { group: 'Katalog', title: 'Dashboard' },
  '/administrator/ingredients': { group: 'Katalog', title: 'Wirkstoffe' },
  '/administrator/products': { group: 'Katalog', title: 'Produkte' },
  '/administrator/dosing': { group: 'Katalog', title: 'Richtwerte' },
  '/administrator/knowledge': { group: 'Katalog', title: 'Wissensdatenbank' },
  '/administrator/translations': { group: 'Katalog', title: 'Übersetzungen' },
  '/administrator/users': { group: 'Konfiguration', title: 'Benutzerverwaltung' },
  '/administrator/shop-domains': { group: 'Konfiguration', title: 'Shop-Domains' },
  '/administrator/management': { group: 'Konfiguration', title: 'Verwaltung' },
  '/administrator/legal': { group: 'Konfiguration', title: 'Rechtliches' },
  '/administrator/profile': { group: 'Konto', title: 'Admin-Profil' },
};

const EXPORT_ENTITIES: Record<string, string> = {
  '/administrator/products': 'products',
  '/administrator/ingredients': 'ingredients',
};

function isActive(pathname: string, item: NavigationItem): boolean {
  if (item.match?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function routeTitle(pathname: string) {
  if (pathname.startsWith('/administrator/products/')) return { group: 'Katalog', title: 'Produktdetail' };
  if (pathname.startsWith('/administrator/ingredients/')) return { group: 'Katalog', title: 'Wirkstoffdetail' };
  return ROUTE_TITLES[pathname] ?? { group: 'Administrator', title: 'Admin-Bereich' };
}

function initials(email?: string): string {
  if (!email) return 'AD';
  const name = email.split('@')[0] ?? '';
  return name
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AD';
}

function StackMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 44 32 56 56 44 32 32Z" fill="#2f6fd8" />
      <path d="M8 32 32 44 56 32 32 20Z" fill="#4ab06b" />
      <path d="M8 20 32 32 56 20 32 8Z" fill="#0f3a44" />
      <rect
        x="28"
        y="6"
        width="14"
        height="22"
        rx="7"
        transform="rotate(-30 35 17)"
        fill="#fff"
        stroke="#0f3a44"
        strokeWidth="1.5"
      />
      <path d="M30.5 11 36 25" stroke="#0f3a44" strokeWidth="1.5" strokeLinecap="round" transform="rotate(-30 35 17)" />
      <rect x="28" y="6" width="7" height="22" rx="3.5" transform="rotate(-30 35 17)" fill="#4ab06b" />
    </svg>
  );
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <nav key={group.title} className="admin-nav-group" aria-label={group.title}>
          <div className="admin-nav-label">{group.title}</div>
          {group.items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={clsx('admin-nav-item', isActive(pathname, item) && 'active')}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ))}
    </>
  );
}

export default function AdministratorShell() {
  const { user, isAdmin, loading, logout } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const currentRoute = routeTitle(location.pathname);
  const userInitials = initials(user?.email);
  const exportEntity = EXPORT_ENTITIES[location.pathname];

  useEffect(() => {
    if (!mobileNavOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  const handleCsvExport = async () => {
    if (!exportEntity || exporting) return;

    const params = new URLSearchParams();
    params.set('entity', exportEntity);
    new URLSearchParams(location.search).forEach((value, key) => {
      if (key !== 'entity') params.append(key, value);
    });

    setExporting(true);
    try {
      const response = await fetch(`/api/admin/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export fehlgeschlagen (${response.status})`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1]
        ? decodeURIComponent(filenameMatch[1])
        : filenameMatch?.[2] ?? `${exportEntity}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV-Export fehlgeschlagen.';
      window.alert(message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-app min-h-screen flex items-center justify-center">
        <div className="admin-muted">Lade Administrator-Oberflaeche...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-app">
      <div className="admin-mobilebar">
        <div className="admin-mobilebar-row">
          <div className="admin-brand" style={{ borderBottom: 0, padding: 0 }}>
            <div className="admin-brand-mark">
              <StackMark />
            </div>
            <div>
              <div className="admin-brand-name">Supplement Stack</div>
              <div className="admin-brand-sub">ADMIN · V0.42</div>
            </div>
          </div>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => setMobileNavOpen((previous) => !previous)}
            aria-label="Navigation umschalten"
            aria-expanded={mobileNavOpen}
            aria-controls="administrator-mobile-navigation"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {mobileNavOpen && (
          <div id="administrator-mobile-navigation" className="admin-mobile-drawer">
            <Navigation pathname={location.pathname} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        )}
      </div>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-brand-mark">
              <StackMark />
            </div>
            <div>
              <div className="admin-brand-name">Supplement Stack</div>
              <div className="admin-brand-sub">ADMIN · V0.42</div>
            </div>
          </div>

          <Navigation pathname={location.pathname} />

          <Link to="/administrator/profile" className="admin-sidebar-footer" title="Admin-Profil oeffnen">
            <div className="admin-avatar">{userInitials}</div>
            <div className="min-w-0 text-xs leading-tight">
              <div className="truncate font-medium text-[color:var(--admin-ink)]">{user.email}</div>
              <div className="admin-muted">Administrator</div>
            </div>
          </Link>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-crumbs">
              <span>Administrator</span>
              <ChevronRight size={12} />
              <span>{currentRoute.group}</span>
              <ChevronRight size={12} />
              <strong>{currentRoute.title}</strong>
            </div>
            <AdministratorCommandPalette />
            {exportEntity && (
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-export-btn"
                onClick={handleCsvExport}
                disabled={exporting}
                title="CSV exportieren"
              >
                <Download size={14} />
                <span>{exporting ? 'Export...' : 'CSV'}</span>
              </button>
            )}
            <button type="button" className="admin-icon-btn" onClick={logout} title="Abmelden" aria-label="Abmelden">
              <LogOut size={16} />
            </button>
          </header>

          <main className="admin-page">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
