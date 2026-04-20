import { Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import StacksPage from './pages/StacksPage';
import WishlistPage from './pages/WishlistPage';
import AdminPage from './pages/AdminPage';
import DemoPage from './pages/DemoPage';
import MyProductsPage from './pages/MyProductsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-6xl font-bold text-indigo-200 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Seite nicht gefunden</h1>
        <p className="text-slate-500 mb-8">
          Die aufgerufene Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Admin — completely separate layout, no normal navbar/footer */}
        <Route
          path="/admin"
          element={
            <AdminLayout>
              <AdminPage />
            </AdminLayout>
          }
        />

        {/* All other routes use the normal Layout */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stacks"
                  element={
                    <ProtectedRoute>
                      <StacksPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wishlist"
                  element={
                    <ProtectedRoute>
                      <WishlistPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/my-products"
                  element={
                    <ProtectedRoute>
                      <MyProductsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
