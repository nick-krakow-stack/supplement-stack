import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authPath, authReturnTo, returnToLabel } from '../lib/returnTo';
import PasswordField from '../components/PasswordField';
import StatusMessage from '../components/StatusMessage';

const SS_DEMO_STACK_HANDOFF_KEY = 'ss_demo_stack_handoff_v1';
const DEMO_STACK_HANDOFF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function hasDemoStackHandoff(): boolean {
  try {
    const raw = window.localStorage.getItem(SS_DEMO_STACK_HANDOFF_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    const candidate = parsed as { version?: unknown; source?: unknown; created_at?: unknown; stacks?: unknown };
    if (candidate.version !== 1 || candidate.source !== 'demo' || !Array.isArray(candidate.stacks)) return false;
    const createdAt = typeof candidate.created_at === 'string' ? Date.parse(candidate.created_at) : Number.NaN;
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > DEMO_STACK_HANDOFF_MAX_AGE_MS) {
      window.localStorage.removeItem(SS_DEMO_STACK_HANDOFF_KEY);
      window.sessionStorage.removeItem(SS_DEMO_STACK_HANDOFF_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function registrationErrorMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 409) return 'Für diese E-Mail-Adresse besteht bereits ein Konto. Du kannst dich direkt anmelden.';
  if (status === 429) return 'Zu viele Versuche. Bitte warte kurz und versuche es dann erneut.';
  return 'Das Konto konnte gerade nicht erstellt werden. Prüfe deine Eingaben und versuche es erneut.';
}

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = authReturnTo(location);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [healthConsent, setHealthConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const demoStackHandoffAvailable = hasDemoStackHandoff();

  useEffect(() => {
    if (!demoStackHandoffAvailable) return;
    try {
      window.sessionStorage.setItem(SS_DEMO_STACK_HANDOFF_KEY, JSON.stringify({ pending: true }));
    } catch {
      // Registrierung bleibt auch ohne Web-Speicher nutzbar.
    }
  }, [demoStackHandoffAvailable]);

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
    if (password.length < 8) {
      setError('Dein Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (!healthConsent) {
      setError('Bitte stimme der Speicherung deiner Stack- und Produktdaten zu, um ein Konto anzulegen.');
      return;
    }
    setSubmitting(true);
    try {
      const redirect = demoStackHandoffAvailable && !returnTo.startsWith('/share/') ? '/stacks' : returnTo;
      const result = await register(normalizedEmail, password, {
        health_consent: true,
        return_to: redirect,
      });
      navigate(authPath('/verify-email', redirect), {
        replace: true,
        state: {
          returnTo: redirect,
          demoStackHandoffKey: demoStackHandoffAvailable ? SS_DEMO_STACK_HANDOFF_KEY : undefined,
          message: result.message,
          emailVerificationEmailSent: result.emailVerificationEmailSent,
        },
      });
    } catch (nextError) {
      setError(registrationErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md">
        <h1 className="mb-2">Kostenlos registrieren</h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          E-Mail, Passwort, fertig. Optionale Angaben kannst du später im Profil ergänzen. Danach kommst du zu {returnToLabel(returnTo)}.
        </p>

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

          <PasswordField
            id="password"
            label="Passwort"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Mindestens 8 Zeichen"
            hint="Nutze mindestens 8 Zeichen und ein Passwort, das du nicht woanders verwendest."
          />

          <div className="border-t border-gray-100 pt-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={healthConsent}
                onChange={(event) => {
                  setHealthConsent(event.target.checked);
                  setError(null);
                }}
                className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold leading-6 text-gray-800">
                Ich stimme zu, dass meine Stack- und Produktdaten gespeichert werden.
              </span>
            </label>
            <details className="ml-8 mt-2 text-sm leading-6 text-slate-600">
              <summary className="min-h-11 cursor-pointer py-2 font-bold text-blue-800">Welche Daten sind gemeint?</summary>
              <p>
                Dazu gehören dein Konto, deine Stacks, Produkte, Mengen, Einnahmezeiten und berechnete Kosten.
                Diese Angaben können etwas über deine Gesundheit aussagen. Die Zustimmung ist für das Speichern erforderlich.
                Mehr dazu steht in der <Link to="/datenschutz" className="font-bold text-blue-700 underline">Datenschutzerklärung</Link>.
              </p>
            </details>
          </div>

          {error && <StatusMessage tone="error">{error}</StatusMessage>}

          <button type="submit" disabled={!healthConsent || submitting} className="mt-2 min-h-11 w-full">
            {submitting ? 'Konto wird erstellt …' : 'Konto erstellen'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Bereits registriert?{' '}
          <Link to={authPath('/login', returnTo)} className="font-medium text-blue-700 hover:underline">Anmelden</Link>
        </p>
      </div>
    </div>
  );
}
