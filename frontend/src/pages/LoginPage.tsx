import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function getAuthRedirect(location: ReturnType<typeof useLocation>): string {
  const state = location.state as { from?: { pathname?: string }; redirect?: string } | null;
  const queryRedirect = new URLSearchParams(location.search).get('redirect');
  const target = state?.redirect ?? state?.from?.pathname ?? queryRedirect ?? '/stacks';
  return target.startsWith('/') && !target.startsWith('//') ? target : '/stacks';
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const redirect = getAuthRedirect(location);
      if (!user.email_verified_at) {
        navigate('/verify-email', { replace: true, state: { redirect } });
      } else {
        navigate(redirect, { replace: true });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Anmeldung fehlgeschlagen. Bitte überprüfe deine Eingaben.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card max-w-sm w-full">
        <h1 className="mb-6">Anmelden</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="deine@email.de"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Passwort
              </label>
              <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
                Passwort vergessen?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="w-full mt-2">
            {submitting ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          Noch kein Konto?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            Jetzt registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
