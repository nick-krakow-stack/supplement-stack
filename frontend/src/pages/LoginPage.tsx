import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authPath, authReturnTo, returnToLabel } from '../lib/returnTo';
import PasswordField from '../components/PasswordField';
import StatusMessage from '../components/StatusMessage';

function loginErrorMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'Zu viele Anmeldeversuche. Bitte warte kurz und versuche es dann erneut.';
  return 'E-Mail-Adresse oder Passwort stimmen nicht. Prüfe deine Eingaben und versuche es erneut.';
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = authReturnTo(location);
  const targetLabel = returnToLabel(returnTo);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="py-16 text-center text-sm font-semibold text-slate-600" role="status">Dein Konto wird geprüft …</div>;
  if (user) return <Navigate to={returnTo} replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Bitte trage eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (!password) {
      setError('Bitte trage dein Passwort ein.');
      return;
    }
    setSubmitting(true);
    try {
      const nextUser = await login(normalizedEmail, password);
      if (!nextUser.email_verified_at) {
        navigate(authPath('/verify-email', returnTo), { replace: true, state: { returnTo } });
      } else {
        navigate(returnTo, { replace: true });
      }
    } catch (nextError) {
      setError(loginErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm">
        <h1 className="mb-2">Anmelden</h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">Nach der Anmeldung kommst du zurück zu {targetLabel}.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              required
              autoComplete="email"
              inputMode="email"
              placeholder="deine@email.de"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-end">
              <Link to={authPath('/forgot-password', returnTo)} className="text-sm font-semibold text-indigo-700 hover:underline">
                Passwort vergessen?
              </Link>
            </div>
            <PasswordField
              id="password"
              label="Passwort"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              required
              autoComplete="current-password"
              placeholder="Dein Passwort"
            />
          </div>

          {error && <StatusMessage tone="error">{error}</StatusMessage>}

          <button type="submit" disabled={submitting} className="mt-2 min-h-11 w-full">
            {submitting ? 'Anmeldung läuft …' : 'Anmelden'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Noch kein Konto?{' '}
          <Link to={authPath('/register', returnTo)} className="font-medium text-blue-700 hover:underline">Jetzt registrieren</Link>
        </p>
      </div>
    </div>
  );
}
