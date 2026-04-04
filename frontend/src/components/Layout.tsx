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
        to="/"
        className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Suche
      </Link>
      <Link
        to="/stacks"
        className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Meine Stacks
      </Link>
      <Link
        to="/wishlist"
        className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Wunschliste
      </Link>
      {user && (
        <Link
          to="/my-products"
          className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          Eigene Produkte
        </Link>
      )}
      <Link
        to="/demo"
        className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Demo
      </Link>
      {isAdmin && (
        <Link
          to="/admin"
          className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
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
        className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        {user.email}
      </Link>
      <button
        onClick={() => { handleLogout(); setMobileOpen(false); }}
        className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
      >
        Abmelden
      </button>
    </>
  ) : (
    <>
      <Link
        to="/login"
        className="text-sm text-gray-700 hover:text-blue-600 font-medium transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Anmelden
      </Link>
      <Link
        to="/register"
        className="text-sm bg-blue-500 text-white hover:bg-blue-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Registrieren
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
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
              className="md:hidden bg-transparent text-gray-700 hover:text-blue-600 p-1"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menü öffnen"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
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
