import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, RefreshCw, XCircle } from 'lucide-react';
import { resendVerificationEmail, verifyEmail } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { authPath, authReturnTo, returnToLabel } from '../lib/returnTo';
import { authDeliveryStatus } from '../lib/authDeliveryState';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token') ?? '';
  const returnTo = authReturnTo(location);
  const [initialDelivery] = useState(() => ({ token, status: authDeliveryStatus(location.pathname) }));
  const deliveryError = initialDelivery.token === token ? initialDelivery.status : null;
  const locationState = location.state as {
    emailVerificationEmailSent?: boolean;
    message?: string;
  } | null;
  const attemptedToken = useRef<string | null>(null);

  const [status, setStatus] = useState<VerifyState>(deliveryError ? 'error' : token ? 'loading' : 'idle');
  const [message, setMessage] = useState<string | null>(() => {
    return deliveryError === 503 ? 'Der Link konnte gerade nicht geprüft werden. Bitte versuche es später noch einmal.'
      : deliveryError ? `Dieser Link ist ${deliveryError === 410 ? 'abgelaufen' : 'ungültig'}. Bitte fordere nach der Anmeldung einen neuen Bestätigungslink an.`
        : locationState?.message ?? null;
  });
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token || deliveryError || attemptedToken.current === token) return;
    attemptedToken.current = token;

    setStatus('loading');
    verifyEmail(token)
      .then(async (res) => {
        setStatus('success');
        setMessage(res.message);
        await refreshUser().catch(() => undefined);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'E-Mail-Adresse konnte nicht bestätigt werden.');
      });
  }, [deliveryError, refreshUser, token]);

  const handleResend = async () => {
    setResendMessage(null);
    setResendError(null);
    setResending(true);
    try {
      const res = await resendVerificationEmail(returnTo);
      setResendMessage(res.message);
      if (res.already_verified) {
        await refreshUser().catch(() => undefined);
      }
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Bestätigungs-E-Mail konnte nicht gesendet werden.');
    } finally {
      setResending(false);
    }
  };

  const isVerified = Boolean(user?.email_verified_at) || status === 'success';
  const messageTone =
    status === 'error'
      ? 'error'
      : locationState?.emailVerificationEmailSent === false && !token
        ? 'warning'
        : 'success';

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          {status === 'success' || isVerified ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden="true" />
          ) : status === 'error' ? (
            <XCircle className="h-7 w-7 text-red-600" aria-hidden="true" />
          ) : (
            <Mail className="h-7 w-7 text-blue-600" aria-hidden="true" />
          )}
          <h1 className="m-0 text-2xl font-bold text-slate-900">E-Mail bestätigen</h1>
        </div>

        {status === 'loading' && (
          <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800" role="status" aria-live="polite">
            Bestätigungslink wird geprüft …
          </p>
        )}

        {message && status !== 'loading' && (
          <p
            role={messageTone === 'error' ? 'alert' : 'status'}
            aria-live={messageTone === 'error' ? 'assertive' : 'polite'}
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              messageTone === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : messageTone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {message}
          </p>
        )}

        {!token && !isVerified && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Wir haben dir einen Bestätigungslink an deine E-Mail-Adresse geschickt.
            </p>
            <p className="text-sm text-slate-500">
              Du kannst Supplement Stack weiter nutzen. Die Bestätigung hilft uns, dein Konto und
              wichtige Konto-Mails sauber zuzuordnen.
            </p>
            <p className="text-sm text-slate-500">
              Der Link ist 48 Stunden gültig. Prüfe bitte auch deinen Spam-Ordner. Danach geht es weiter zu {returnToLabel(returnTo)}.
            </p>
          </div>
        )}

        {isVerified && (
          <p className="text-sm text-slate-600">
            Deine E-Mail-Adresse ist bestätigt.
          </p>
        )}

        {user && !isVerified && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">{user.email}</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {resending ? 'Wird gesendet...' : 'E-Mail erneut senden'}
            </button>
            {resendMessage && (
              <p className="mt-3 text-sm font-medium text-emerald-700" role="status" aria-live="polite">{resendMessage}</p>
            )}
            {resendError && (
              <p className="mt-3 text-sm font-medium text-red-700" role="alert">{resendError}</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {deliveryError === 503 && <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-xl px-5 py-2 font-bold">Erneut versuchen</button>}
          {user ? (
            <Link
              to={returnTo}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Weiter zu Supplement Stack
            </Link>
          ) : (
            <Link
              to={authPath('/login', returnTo)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Anmelden
            </Link>
          )}
          {user && (
            <Link
              to="/profile"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Profil öffnen
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
