import { useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import {
  BarChart3,
  Package,
  FlaskConical,
  AlertTriangle,
  ShoppingBag,
  Trophy,
  UserCheck,
  Languages,
  Link2,
  Pill,
  History,
  ChevronLeft,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AppLogo from './AppLogo';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

type TabId =
  | 'stats'
  | 'products'
  | 'ingredients'
  | 'translations'
  | 'ingredient_sub_ingredients'
  | 'dose_recommendations'
  | 'audit_log'
  | 'interactions'
  | 'shop_domains'
  | 'rankings'
  | 'user_products';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'stats', label: 'Statistiken', icon: <BarChart3 size={18} /> },
  { id: 'products', label: 'Produkte', icon: <Package size={18} /> },
  { id: 'ingredients', label: 'Zutaten', icon: <FlaskConical size={18} /> },
  { id: 'translations', label: 'Translations', icon: <Languages size={18} /> },
  { id: 'ingredient_sub_ingredients', label: 'Sub-Ingredients', icon: <Link2 size={18} /> },
  { id: 'dose_recommendations', label: 'Dose-Richtwerte', icon: <Pill size={18} /> },
  { id: 'audit_log', label: 'Audit-Log', icon: <History size={18} /> },
  { id: 'interactions', label: 'Wechselwirkungen', icon: <AlertTriangle size={18} /> },
  { id: 'shop_domains', label: 'Shop-Domains', icon: <ShoppingBag size={18} /> },
  { id: 'rankings', label: 'Rankings', icon: <Trophy size={18} /> },
  { id: 'user_products', label: 'User-Produkte', icon: <UserCheck size={18} /> },
];

const TAB_LABELS: Record<TabId, string> = {
  stats: 'Statistiken',
  products: 'Produkte',
  ingredients: 'Zutaten',
  translations: 'Translations',
  ingredient_sub_ingredients: 'Sub-Ingredients',
  dose_recommendations: 'Dose-Richtwerte',
  audit_log: 'Audit-Log',
  interactions: 'Wechselwirkungen',
  shop_domains: 'Shop-Domains',
  rankings: 'Rankings',
  user_products: 'User-Produkte',
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isAdmin, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Wait for auth to resolve
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  // Auth guard
  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') ?? 'stats') as TabId;
  const activeLabel = TAB_LABELS[activeTab] ?? 'Admin';

  const handleNavClick = (tabId: TabId) => {
    navigate(`/admin?tab=${tabId}`);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex flex-col items-start gap-2.5">
          <AppLogo variant="admin" />
          <p className="text-slate-400 text-xs font-semibold tracking-wide">Admin</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div className="px-3 py-4 border-t border-slate-800 flex flex-col gap-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <ChevronLeft size={18} />
          Zurück zur App
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — desktop (fixed) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile (overlay) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside className="relative flex flex-col w-64 bg-slate-900 h-full shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Sidebar schließen"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20">
          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Menü öffnen"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base font-semibold text-slate-900 truncate">{activeLabel}</h1>
          </div>

          {/* Right: user email + logout */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden sm:block text-sm text-slate-500 truncate max-w-[200px]">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
