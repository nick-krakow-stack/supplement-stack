import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LegalDisclaimer from './LegalDisclaimer';

interface LayoutProps {
  children: React.ReactNode;
}

const navLinkClass =
  'text-sm font-extrabold tracking-wide text-slate-500 transition-colors hover:text-blue-700';

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
      <Link to="/search" className={navLinkClass} onClick={closeMobile}>
        Suchen
      </Link>
      <Link to="/stacks" className={navLinkClass} onClick={closeMobile}>
        Meine Stacks
      </Link>
      <Link to="/wishlist" className={navLinkClass} onClick={closeMobile}>
        Wunschliste
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
          to="/admin"
          className="text-sm font-extrabold tracking-wide text-amber-600 transition-colors hover:text-amber-700"
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
        className="text-sm font-bold text-slate-500 transition-colors hover:text-blue-700"
        onClick={closeMobile}
      >
        {user.email}
      </Link>
      <button
        onClick={() => {
          handleLogout();
          closeMobile();
        }}
        className="border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
      >
        Abmelden
      </button>
    </>
  ) : (
    <>
      <Link
        to="/login"
        className="text-sm font-extrabold text-slate-500 transition-colors hover:text-blue-700"
        onClick={closeMobile}
      >
        Anmelden
      </Link>
      <Link
        to="/register"
        className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-violet-700"
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
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xl font-black tracking-wide text-slate-900"
              onClick={closeMobile}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700">
                <Leaf size={19} />
              </span>
              <span className="bg-gradient-to-r from-blue-700 to-violet-700 bg-clip-text text-transparent">
                Supplement Stack
              </span>
            </Link>

            <div className="hidden items-center gap-7 md:flex">{navLinks}</div>
            <div className="hidden items-center gap-4 md:flex">{authLinks}</div>

            <button
              className="bg-transparent p-1 text-slate-500 transition-colors hover:text-blue-700 md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Menü öffnen"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="flex flex-col gap-4 rounded-b-2xl border-t border-slate-100 bg-white px-4 py-4 shadow-lg md:hidden">
            {navLinks}
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
              {authLinks}
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="mx-auto max-w-[1280px] px-4 pb-6 pt-2 sm:px-6 lg:px-8 space-y-1">
        <LegalDisclaimer variant="affiliate" />
        <LegalDisclaimer variant="health" />
      </footer>
    </div>
  );
}
