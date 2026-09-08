import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CookieConsentBanner from './components/CookieConsentBanner';
import RouteMetadata from './components/RouteMetadata';
import NotFoundPage from './pages/NotFoundPage';
import { routeLoadingText } from './lib/routeLoadingText';
import './components/LegalDocument.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const StacksPage = lazy(() => import('./pages/StacksPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const IntakePlanIntroPage = lazy(() => import('./pages/IntakePlanIntroPage'));
const MyProductsPage = lazy(() => import('./pages/MyProductsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const ImprintPage = lazy(() => import('./pages/ImprintPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const KnowledgeOverviewPage = lazy(() => import('./pages/KnowledgeOverviewPage'));
const KnowledgeArticlePage = lazy(() => import('./pages/KnowledgeArticlePage'));
const StackWorkspace = lazy(() => import('./components/StackWorkspace'));
const CreatorSharingPage = lazy(() => import('./pages/CreatorSharingPage'));
const CreatorShareImportPage = lazy(() => import('./pages/CreatorShareImportPage'));
const CreatorPublicProfilePage = lazy(() => import('./pages/CreatorPublicProfilePage'));

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
const AdministratorResearchPage = lazy(() => import('./pages/administrator/AdministratorResearchPage'));
const AdministratorCreatorSharingPage = lazy(() => import('./pages/administrator/AdministratorCreatorSharingPage'));

function RouteLoadingFallback() {
  const location = useLocation();
  if (location.pathname === '/wissen') return null;
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-6">
      <div className="text-sm font-semibold text-slate-600" role="status" aria-live="polite">
        {routeLoadingText(location.pathname)}
      </div>
    </div>
  );
}

function RoutinePageRoute() {
  const { user } = useAuth();
  return <StackWorkspace mode={user ? 'authenticated' : 'demo'} standaloneHeader={false} view="routine" />;
}

export default function App() {
  const location = useLocation();
  const hideCookieBanner = location.pathname.startsWith('/administrator');

  return (
    <AuthProvider>
      <RouteMetadata />
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
            <Route path="research" element={<AdministratorResearchPage />} />
            <Route path="legal" element={<AdministratorLegalPage />} />
            <Route path="profile" element={<AdministratorProfilePage />} />
            <Route path="rankings" element={<AdministratorRankingsPage />} />
            <Route path="sub-ingredients" element={<AdministratorSubIngredientsPage />} />
            <Route path="settings" element={<AdministratorSettingsPage />} />
            <Route path="creator-sharing" element={<AdministratorCreatorSharingPage />} />
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
          <Route
            path="/demo"
            element={
              <Layout>
                <DemoPage />
              </Layout>
            }
          />
          <Route
            path="/creator"
            element={
              <Layout>
                <ProtectedRoute>
                  <CreatorSharingPage />
                </ProtectedRoute>
              </Layout>
            }
          />
          <Route
            path="/einnahmeplan"
            element={
              <Layout>
                <ProtectedRoute><RoutinePageRoute /></ProtectedRoute>
              </Layout>
            }
          />

          <Route
            path="*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/einnahmeplan-erstellen" element={<IntakePlanIntroPage />} />
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
                  <Route path="/agb" element={<Navigate to="/nutzungsbedingungen" replace />} />
                  <Route path="/wissen" element={<KnowledgeOverviewPage />} />
                  <Route path="/wissen/:slug" element={<KnowledgeArticlePage />} />
                  <Route path="/share/:token" element={<CreatorShareImportPage />} />
                  <Route path="/creator/:slug" element={<CreatorPublicProfilePage />} />
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
