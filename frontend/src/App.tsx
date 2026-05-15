import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CookieConsentBanner from './components/CookieConsentBanner';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const StacksPage = lazy(() => import('./pages/StacksPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const MyProductsPage = lazy(() => import('./pages/MyProductsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const ImprintPage = lazy(() => import('./pages/ImprintPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const KnowledgeArticlePage = lazy(() => import('./pages/KnowledgeArticlePage'));

const AdministratorShell = lazy(() => import('./pages/administrator/AdministratorShell'));
const AdministratorDashboardPage = lazy(() => import('./pages/administrator/AdministratorDashboardPage'));
const AdministratorProductsPage = lazy(() => import('./pages/administrator/AdministratorProductsPage'));
const AdministratorProductCreatePage = lazy(() => import('./pages/administrator/AdministratorProductCreatePage'));
const AdministratorInteractionsPage = lazy(() => import('./pages/administrator/AdministratorInteractionsPage'));
const AdministratorDosingPage = lazy(() => import('./pages/administrator/AdministratorDosingPage'));
const AdministratorHealthPage = lazy(() => import('./pages/administrator/AdministratorHealthPage'));
const AdministratorIngredientsPage = lazy(() => import('./pages/administrator/AdministratorIngredientsPage'));
const AdministratorUserProductsPage = lazy(() => import('./pages/administrator/AdministratorUserProductsPage'));
const AdministratorProductDetailPage = lazy(() => import('./pages/administrator/AdministratorProductDetailPage'));
const AdministratorIngredientDetailPage = lazy(() => import('./pages/administrator/AdministratorIngredientDetailPage'));
const AdministratorProductQAPage = lazy(() => import('./pages/administrator/AdministratorProductQAPage'));
const AdministratorLinkReportsPage = lazy(() => import('./pages/administrator/AdministratorLinkReportsPage'));
const AdministratorKnowledgePage = lazy(() => import('./pages/administrator/AdministratorKnowledgePage'));
const AdministratorLaunchChecksPage = lazy(() => import('./pages/administrator/AdministratorLaunchChecksPage'));
const AdministratorShopDomainsPage = lazy(() => import('./pages/administrator/AdministratorShopDomainsPage'));
const AdministratorRankingsPage = lazy(() => import('./pages/administrator/AdministratorRankingsPage'));
const AdministratorTranslationsPage = lazy(() => import('./pages/administrator/AdministratorTranslationsPage'));
const AdministratorSubIngredientsPage = lazy(() => import('./pages/administrator/AdministratorSubIngredientsPage'));
const AdministratorUsersPage = lazy(() => import('./pages/administrator/AdministratorUsersPage'));
const AdministratorSettingsPage = lazy(() => import('./pages/administrator/AdministratorSettingsPage'));
const AdministratorLegalPage = lazy(() => import('./pages/administrator/AdministratorLegalPage'));
const AdministratorProfilePage = lazy(() => import('./pages/administrator/AdministratorProfilePage'));
const AdministratorManagementPage = lazy(() => import('./pages/administrator/AdministratorManagementPage'));

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

function RouteLoadingFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-6">
      <div className="text-sm text-slate-500">Laden...</div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const hideCookieBanner = location.pathname.startsWith('/administrator');

  return (
    <AuthProvider>
      {!hideCookieBanner && <CookieConsentBanner />}
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/administrator" element={<AdministratorShell />}>
            <Route index element={<Navigate to="/administrator/dashboard" replace />} />
            <Route path="dashboard" element={<AdministratorDashboardPage />} />
            <Route path="ingredients" element={<AdministratorIngredientsPage />} />
            <Route path="ingredients/:id" element={<AdministratorIngredientDetailPage />} />
            <Route path="products" element={<AdministratorProductsPage />} />
            <Route path="products/new" element={<AdministratorProductCreatePage />} />
            <Route path="products/:id" element={<AdministratorProductDetailPage />} />
            <Route path="interactions" element={<AdministratorInteractionsPage />} />
            <Route path="dosing" element={<AdministratorDosingPage />} />
            <Route path="health" element={<AdministratorHealthPage />} />
            <Route path="knowledge" element={<AdministratorKnowledgePage />} />
            <Route path="translations" element={<AdministratorTranslationsPage />} />
            <Route path="user-products" element={<AdministratorUserProductsPage />} />
            <Route path="product-qa" element={<AdministratorProductQAPage />} />
            <Route path="link-reports" element={<AdministratorLinkReportsPage />} />
            <Route path="launch-checks" element={<AdministratorLaunchChecksPage />} />
            <Route path="users" element={<AdministratorUsersPage />} />
            <Route path="shop-domains" element={<AdministratorShopDomainsPage />} />
            <Route path="management" element={<AdministratorManagementPage />} />
            <Route path="legal" element={<AdministratorLegalPage />} />
            <Route path="profile" element={<AdministratorProfilePage />} />
            <Route path="rankings" element={<AdministratorRankingsPage />} />
            <Route path="sub-ingredients" element={<AdministratorSubIngredientsPage />} />
            <Route path="settings" element={<AdministratorSettingsPage />} />
            <Route path="*" element={<Navigate to="/administrator/dashboard" replace />} />
          </Route>

          <Route
            path="/stacks"
            element={
              <Layout>
                <ProtectedRoute>
                  <StacksPage />
                </ProtectedRoute>
              </Layout>
            }
          />
          <Route path="/demo" element={<DemoPage />} />

          <Route
            path="*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
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
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/impressum" element={<ImprintPage />} />
                  <Route path="/datenschutz" element={<PrivacyPage />} />
                  <Route path="/nutzungsbedingungen" element={<TermsPage />} />
                  <Route path="/agb" element={<TermsPage />} />
                  <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
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
      </Suspense>
    </AuthProvider>
  );
}
