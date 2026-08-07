import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authPath, currentLocationReturnTo } from '../lib/returnTo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (!user) {
    const returnTo = currentLocationReturnTo(location);
    return <Navigate to={authPath('/login', returnTo)} replace state={{ returnTo }} />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <h1 className="text-2xl font-bold text-red-600">403 – Kein Zugriff</h1>
        <p className="text-gray-600">Du hast keine Berechtigung, diese Seite aufzurufen.</p>
      </div>
    );
  }

  return <>{children}</>;
}
