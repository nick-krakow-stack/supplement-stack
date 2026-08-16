import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LegalDisclaimer from './LegalDisclaimer';
import AppLogo from './AppLogo';
import { resetAnalyticsConsentChoice } from '../lib/analytics';
import { creatorSharingEnabled } from '../api/creatorSharing';

interface LayoutProps {
  children: React.ReactNode;
}

const navLinkClass =
  'flex min-h-11 items-center rounded-xl px-2 text-sm font-extrabold tracking-wide text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-700 md:min-h-0 md:px-0 md:hover:bg-transparent';

function navClass({ isActive }: { isActive: boolean }): string {
  return `${navLinkClass}${isActive ? ' text-blue-700' : ''}`;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMobileOpen(false);
      mobileToggleRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    });
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMobile = () => setMobileOpen(false);

  const navLinks = (
    <>
      <NavLink to="/wissen" className={navClass} onClick={closeMobile}>Wissen</NavLink>
      <NavLink to="/stacks" className={navClass} onClick={closeMobile}>Meine Stacks</NavLink>
      <NavLink to="/einnahmeplan" className={navClass} onClick={closeMobile}>Einnahmeplan</NavLink>
      {user && <NavLink to="/my-products" className={navClass} onClick={closeMobile}>Eigene Produkte</NavLink>}
      {user && creatorSharingEnabled && <NavLink to="/creator" className={navClass} onClick={closeMobile}>Für Creator</NavLink>}
      {!user && <NavLink to="/demo" className={navClass} onClick={closeMobile}>Demo</NavLink>}
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
      <NavLink
        to="/profile"
        className={({ isActive }) => `flex min-h-11 min-w-0 flex-col items-start justify-center rounded-xl px-2 text-sm font-bold leading-tight transition-colors hover:bg-slate-50 hover:text-blue-700 md:min-h-0 md:max-w-[180px] md:px-0 md:hover:bg-transparent ${isActive ? 'text-blue-700' : 'text-slate-500'}`}
        onClick={closeMobile}
      >
        <span>Mein Profil</span>
        <span className="min-w-0 max-w-full truncate text-xs font-semibold text-slate-400">{user.email}</span>
      </NavLink>
      <button
        type="button"
        onClick={() => {
          void handleLogout();
          closeMobile();
        }}
        className="min-h-11 border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
      >
        Abmelden
      </button>
    </>
  ) : (
    <>
      <NavLink to="/login" className={navClass} onClick={closeMobile}>Anmelden</NavLink>
      <NavLink
        to="/register"
        className="flex min-h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-violet-700"
        onClick={closeMobile}
      >
        Registrieren
      </NavLink>
    </>
  );

  const knowledgeRoute = location.pathname === '/wissen' || location.pathname.startsWith('/wissen/');

  return (
    <div className="min-h-screen bg-transparent">
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl" aria-label="Hauptnavigation">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <AppLogo onClick={closeMobile} />
            <div className="hidden items-center gap-7 md:flex">{navLinks}</div>
            <div className="hidden items-center gap-4 md:flex">{authLinks}</div>
            <button
              ref={mobileToggleRef}
              type="button"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center bg-transparent p-0 text-slate-500 transition-colors hover:text-blue-700 md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            ref={mobileMenuRef}
            id="mobile-navigation"
            className="flex flex-col gap-1 rounded-b-2xl border-t border-slate-100 bg-white px-4 py-4 shadow-lg md:hidden"
          >
            {navLinks}
            <div className="flex min-w-0 flex-col gap-2 border-t border-slate-100 pt-4">{authLinks}</div>
          </div>
        )}
      </nav>

      {user && !user.guideline_source && location.pathname !== '/profile' && (
        <aside className="mx-auto mt-4 flex max-w-[1280px] items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:px-6" aria-label="Profil noch nicht vollständig">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">Deine Quellenpräferenz ist noch nicht ausgewählt.</p>
            <p className="mt-1 leading-6">Bis dahin zeigen wir dir offizielle Referenzwerte zuerst. Du kannst das jederzeit im Profil ändern.</p>
            <Link to="/profile#preferences" className="mt-2 inline-flex min-h-11 items-center font-bold text-blue-800 underline underline-offset-4">Präferenz auswählen</Link>
          </div>
        </aside>
      )}

      {knowledgeRoute ? (
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      ) : (
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      )}

      <footer className="mx-auto max-w-[1280px] space-y-1 px-4 pb-6 pt-2 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500" aria-label="Rechtliches">
          <Link to="/impressum" className="min-h-11 py-3 hover:text-blue-700 hover:underline">Impressum</Link>
          <Link to="/datenschutz" className="min-h-11 py-3 hover:text-blue-700 hover:underline">Datenschutz</Link>
          <Link to="/nutzungsbedingungen" className="min-h-11 py-3 hover:text-blue-700 hover:underline">Nutzungsbedingungen</Link>
          <button
            type="button"
            onClick={resetAnalyticsConsentChoice}
            className="min-h-11 rounded-none bg-transparent p-0 text-xs font-bold text-slate-500 hover:text-blue-700 hover:underline"
          >
            Cookie-Einstellungen
          </button>
        </nav>
        <p className="text-xs font-semibold text-slate-500">Rechtstexte: Stand 16. August 2026</p>
        <LegalDisclaimer variant="affiliate" />
        <LegalDisclaimer variant="health" />
      </footer>
    </div>
  );
}
