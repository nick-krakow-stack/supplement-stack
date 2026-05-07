import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LegalDisclaimer from './LegalDisclaimer';
import AppLogo from './AppLogo';
import { resetAnalyticsConsentChoice } from '../lib/analytics';

interface LayoutProps {
  children: React.ReactNode;
}

const navLinkClass =
  'flex min-h-11 items-center rounded-xl px-2 text-sm font-extrabold tracking-wide text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-700 md:min-h-0 md:px-0 md:hover:bg-transparent';

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobile = () => setMobileOpen(false);

  const navLinks = (
    <>
      <Link to="/stacks" className={navLinkClass} onClick={closeMobile}>
        Meine Stacks
      </Link>
      {user && (
        <Link to="/my-products" className={navLinkClass} onClick={closeMobile}>
          Eigene Produkte
        </Link>
      )}
      {!user && (
        <Link to="/demo" className={navLinkClass} onClick={closeMobile}>
          Demo
        </Link>
      )}
      {isAdmin && (
        <Link
          to="/administrator"
          className="flex min-h-11 items-center rounded-xl px-2 text-sm font-extrabold tracking-wide text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 md:min-h-0 md:px-0 md:hover:bg-transparent"
          onClick={closeMobile}
        >
          Admin
        </Link>
      )}
    </>
  );

  const authLinks = user ? (
    <>
      <Link
        to="/profile"
        className="flex min-h-11 min-w-0 items-center rounded-xl px-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-700 md:min-h-0 md:max-w-[180px] md:px-0 md:hover:bg-transparent"
        onClick={closeMobile}
      >
        <span className="min-w-0 truncate break-all">{user.email}</span>
      </Link>
      <button
        onClick={() => {
          handleLogout();
          closeMobile();
        }}
        className="min-h-11 border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
      >
        Abmelden
      </button>
    </>
  ) : (
    <>
      <Link
        to="/login"
        className="flex min-h-11 items-center rounded-xl px-2 text-sm font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-700 md:min-h-0 md:px-0 md:hover:bg-transparent"
        onClick={closeMobile}
      >
        Anmelden
      </Link>
      <Link
        to="/register"
        className="flex min-h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-violet-700"
        onClick={closeMobile}
      >
        Registrieren
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-transparent">
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <AppLogo onClick={closeMobile} />

            <div className="hidden items-center gap-7 md:flex">{navLinks}</div>
            <div className="hidden items-center gap-4 md:flex">{authLinks}</div>

            <button
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center bg-transparent p-0 text-slate-500 transition-colors hover:text-blue-700 md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Menü öffnen"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="flex flex-col gap-1 rounded-b-2xl border-t border-slate-100 bg-white px-4 py-4 shadow-lg md:hidden">
            {navLinks}
            <div className="flex min-w-0 flex-col gap-2 border-t border-slate-100 pt-4">
              {authLinks}
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="mx-auto max-w-[1280px] px-4 pb-6 pt-2 sm:px-6 lg:px-8 space-y-1">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
          <Link to="/impressum" className="hover:text-blue-700 hover:underline">
            Impressum
          </Link>
          <Link to="/datenschutz" className="hover:text-blue-700 hover:underline">
            Datenschutz
          </Link>
          <Link to="/nutzungsbedingungen" className="hover:text-blue-700 hover:underline">
            Nutzungsbedingungen
          </Link>
          <button
            type="button"
            onClick={resetAnalyticsConsentChoice}
            className="rounded-none bg-transparent p-0 text-xs font-bold text-slate-500 hover:text-blue-700 hover:underline"
          >
            Cookie-Einstellungen
          </button>
        </nav>
        <LegalDisclaimer variant="affiliate" />
        <LegalDisclaimer variant="health" />
      </footer>
    </div>
  );
}
