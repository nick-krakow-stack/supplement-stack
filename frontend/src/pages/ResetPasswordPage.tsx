import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="card max-w-sm w-full text-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            Ungültiger Link. Bitte fordere einen neuen an.
          </p>
          <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="card max-w-sm w-full text-center flex flex-col gap-4">
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            Passwort geändert! Du kannst dich jetzt anmelden.
          </p>
          <Link to="/login" className="text-sm text-indigo-600 hover:underline">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card max-w-sm w-full">
        <h1 className="mb-2">Neues Passwort setzen</h1>
        <p className="text-sm text-gray-500 mb-6">
          Wähle ein neues Passwort mit mindestens 8 Zeichen.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Neues Passwort
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

          <div>
            <label htmlFor="password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort bestätigen
            </label>
            <input
              id="password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Passwort wiederholen"
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {validationError}
            </p>
          )}

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="w-full mt-2">
            {submitting ? 'Wird gespeichert...' : 'Passwort speichern'}
          </button>

          <p className="text-sm text-center text-gray-500">
            <Link to="/login" className="text-indigo-600 hover:underline">
              Zurück zur Anmeldung
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
