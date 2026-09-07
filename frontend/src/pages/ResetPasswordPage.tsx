import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { authPath, authReturnTo, returnToLabel } from '../lib/returnTo';
import PasswordField from '../components/PasswordField';
import StatusMessage from '../components/StatusMessage';
import { authDeliveryStatus } from '../lib/authDeliveryState';

function passwordQuality(password: string): { label: string; color: string } {
  if (!password) return { label: 'Noch nicht eingegeben', color: 'bg-slate-200' };
  let points = password.length >= 8 ? 1 : 0;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password) && /[^\da-z]/i.test(password)) points += 1;
  if (points >= 4) return { label: 'Stark', color: 'bg-emerald-500' };
  if (points >= 2) return { label: 'Mittel', color: 'bg-amber-500' };
  return { label: 'Zu kurz oder leicht zu erraten', color: 'bg-red-500' };
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token') ?? '';
  const returnTo = authReturnTo(location);
  const [initialDelivery] = useState(() => ({ token, status: authDeliveryStatus(location.pathname) }));
  const deliveryError = initialDelivery.token === token ? initialDelivery.status : null;
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const quality = useMemo(() => passwordQuality(password), [password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);
    setServerError(null);
    setLinkExpired(false);

    if (password.length < 8) {
      setValidationError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== passwordConfirm) {
      setValidationError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setLinkExpired(status === 410);
      setServerError(status === 410
        ? 'Dieser Link ist abgelaufen. Bitte fordere einen neuen an.'
        : status === 400
          ? 'Dieser Link ist ungültig oder wurde bereits verwendet. Bitte fordere einen neuen an.'
          : 'Das Passwort konnte gerade nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  if (deliveryError) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center"><div className="card w-full max-w-sm">
        <h1 className="mb-4">{deliveryError === 503 ? 'Link gerade nicht prüfbar' : deliveryError === 410 ? 'Link abgelaufen' : 'Link ungültig'}</h1>
        <StatusMessage tone="error">{deliveryError === 503 ? 'Der Link konnte gerade nicht geprüft werden. Bitte versuche es später noch einmal.' : 'Bitte fordere einen neuen Link an, um dein Passwort zurückzusetzen.'}</StatusMessage>
        {deliveryError === 503 ? <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11">Erneut versuchen</button> : <Link to={authPath('/forgot-password', returnTo)} className="mt-4 inline-flex min-h-11 items-center font-bold text-indigo-700 hover:underline">Neuen Link anfordern</Link>}
      </div></div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="card w-full max-w-sm">
          <h1 className="mb-4">Link fehlt</h1>
          <StatusMessage tone="error">In diesem Aufruf fehlt der persönliche Rücksetz-Link.</StatusMessage>
          <Link to={authPath('/forgot-password', returnTo)} className="mt-4 inline-flex min-h-11 items-center font-bold text-indigo-700 hover:underline">Neuen Link anfordern</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="card flex w-full max-w-sm flex-col gap-4">
          <h1>Passwort gespeichert</h1>
          <StatusMessage tone="success">Dein Passwort wurde geändert. Melde dich jetzt an; danach kommst du zurück zu {returnToLabel(returnTo)}.</StatusMessage>
          <Link to={authPath('/login', returnTo)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">Zur Anmeldung</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm">
        <h1 className="mb-2">Neues Passwort festlegen</h1>
        <p className="mb-6 text-sm leading-6 text-gray-600">Nutze mindestens 8 Zeichen und möglichst ein nur hier verwendetes Passwort.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PasswordField
            id="password"
            label="Neues Passwort"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
              <div className={`h-full ${quality.color}`} style={{ width: password ? (quality.label === 'Stark' ? '100%' : quality.label === 'Mittel' ? '66%' : '33%') : '0%' }} />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-600">Passwortqualität: {quality.label}</p>
          </div>

          <PasswordField
            id="password-confirm"
            label="Passwort wiederholen"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          {validationError && <StatusMessage tone="error">{validationError}</StatusMessage>}
          {serverError && (
            <StatusMessage tone="error">
              {serverError}
              {(linkExpired || serverError.includes('ungültig')) && (
                <> <Link to={authPath('/forgot-password', returnTo)} className="font-bold underline">Neuen Link anfordern</Link></>
              )}
            </StatusMessage>
          )}

          <button type="submit" disabled={submitting} className="mt-2 min-h-11 w-full">
            {submitting ? 'Passwort wird gespeichert …' : 'Passwort speichern'}
          </button>

          <Link to={authPath('/login', returnTo)} className="min-h-11 py-3 text-center text-sm font-bold text-indigo-700 hover:underline">Zurück zur Anmeldung</Link>
        </form>
      </div>
    </div>
  );
}
