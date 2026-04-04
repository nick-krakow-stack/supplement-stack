import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = (
    <>
      <Link
        to="/search"
        className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Suchen
      </Link>
      <Link
        to="/stacks"
        className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Meine Stacks
      </Link>
      <Link
        to="/wishlist"
        className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Wunschliste
      </Link>
      {user && (
        <Link
          to="/my-products"
          className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          Eigene Produkte
        </Link>
      )}
      <Link
        to="/demo"
        className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Demo
      </Link>
      {isAdmin && (
        <Link
          to="/admin"
          className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
          onClick={() => setMobileOpen(false)}
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
        className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        {user.email}
      </Link>
      <button
        onClick={() => { handleLogout(); setMobileOpen(false); }}
        className="text-sm border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl px-4 py-2 transition-colors"
      >
        Abmelden
      </button>
    </>
  ) : (
    <>
      <Link
        to="/login"
        className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Anmelden
      </Link>
      <Link
        to="/register"
        className="text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl px-5 py-2.5 transition-all duration-200 shadow-sm"
        onClick={() => setMobileOpen(false)}
      >
        Registrieren
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold text-lg"
            >
              Supplement Stack
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks}
            </div>

            {/* Desktop auth */}
            <div className="hidden md:flex items-center gap-3">
              {authLinks}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden bg-transparent text-gray-500 hover:text-indigo-600 p-1 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menü öffnen"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 px-4 py-4 flex flex-col gap-4 bg-white shadow-lg rounded-b-2xl">
            {navLinks}
            <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
              {authLinks}
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
