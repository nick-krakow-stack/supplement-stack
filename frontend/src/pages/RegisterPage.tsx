import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

function getAuthRedirect(location: ReturnType<typeof useLocation>): string {
  const state = location.state as { from?: { pathname?: string }; redirect?: string } | null;
  const queryRedirect = new URLSearchParams(location.search).get('redirect');
  const target = state?.redirect ?? state?.from?.pathname ?? queryRedirect ?? '/stacks';
  return target.startsWith('/') && !target.startsWith('//') ? target : '/stacks';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [guidelineSource, setGuidelineSource] = useState('');
  const [healthConsent, setHealthConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const demoStackHandoffAvailable = hasDemoStackHandoff();

  useEffect(() => {
    if (!demoStackHandoffAvailable) return;
    try {
      window.sessionStorage.setItem(SS_DEMO_STACK_HANDOFF_KEY, JSON.stringify({ pending: true }));
    } catch {
      // Keep registration usable when storage is unavailable.
    }
  }, [demoStackHandoffAvailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ageTrimmed = age.trim();
      const ageNum = ageTrimmed === '' ? undefined : Number.parseInt(ageTrimmed, 10);
      const result = await register(email, password, {
        health_consent: healthConsent,
        age: Number.isFinite(ageNum) ? (ageNum as number) : undefined,
        guideline_source: guidelineSource === '' ? undefined : guidelineSource,
      });
      const redirect = demoStackHandoffAvailable ? '/stacks' : getAuthRedirect(location);
      navigate('/verify-email', {
        replace: true,
        state: {
          redirect,
          demoStackHandoffKey: demoStackHandoffAvailable ? SS_DEMO_STACK_HANDOFF_KEY : undefined,
          message: result.message,
          emailVerificationEmailSent: result.emailVerificationEmailSent,
        },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registrierung fehlgeschlagen. Bitte versuche es erneut.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card max-w-sm w-full">
        <h1 className="mb-6">Registrieren</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail-Adresse <span className="text-red-500">*</span>
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-3">
              Optional: Alter und bevorzugte Quellenpraeferenz koennen spaeter geaendert werden.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Alter
                </label>
                <input
                  id="age"
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="z. B. 30"
                />
              </div>

              <div>
                <label htmlFor="guideline_source" className="block text-sm font-medium text-gray-700 mb-1">
                  Leitlinienquelle
                </label>
                <select
                  id="guideline_source"
                  value={guidelineSource}
                  onChange={(e) => setGuidelineSource(e.target.value)}
                  className="input"
                >
                  <option value="">Keine Angabe</option>
                  <option value="DGE">DGE</option>
                  <option value="studien">Studien</option>
                  <option value="influencer">Influencer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={healthConsent}
                onChange={(e) => setHealthConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Ich stimme der Verarbeitung von Accountdaten, optionalem Alter, optionaler
                Leitlinienquelle sowie gespeicherten Stack-, Produkt-, Dosierungs-, Einnahmeintervall-
                und Kostendaten zu. Diese Angaben koennen gesundheitsnah sein, enthalten aber keine
                Diagnose-, Krankheits-, Medikamenten-, Geschlechts-, Ernaehrungs-, Ziel- oder
                Raucherstatus-Felder.
                <span className="text-xs text-gray-500"> (DSGVO Art. 9 erforderlich)</span>
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={!healthConsent || submitting} className="w-full mt-2">
            {submitting ? 'Registrieren...' : 'Konto erstellen'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          Bereits registriert?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
