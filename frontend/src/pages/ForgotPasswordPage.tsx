import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { authPath, authReturnTo, returnToLabel } from '../lib/returnTo';
import StatusMessage from '../components/StatusMessage';

export default function ForgotPasswordPage() {
  const location = useLocation();
  const returnTo = authReturnTo(location);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email, return_to: returnTo });
    } catch {
      // Absichtlich derselbe Abschlusszustand, damit keine Konten offengelegt werden.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm">
        <h1 className="mb-2">Passwort zurücksetzen</h1>
        <p className="mb-6 text-sm leading-6 text-gray-600">
          Gib deine E-Mail-Adresse ein. Der Link bringt dich nach dem neuen Passwort zurück zu {returnToLabel(returnTo)}.
        </p>

        {submitted ? (
          <div className="flex flex-col gap-4">
            <StatusMessage tone="success">
              Falls zu dieser E-Mail-Adresse ein Konto gehört, haben wir einen Link verschickt. Prüfe bitte auch deinen Spam-Ordner. Der Link ist eine Stunde gültig.
            </StatusMessage>
            <Link to={authPath('/login', returnTo)} className="min-h-11 py-3 text-center text-sm font-bold text-indigo-700 hover:underline">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-gray-700">E-Mail-Adresse</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                placeholder="deine@email.de"
              />
            </div>

            <button type="submit" disabled={submitting} className="mt-2 min-h-11 w-full">
              {submitting ? 'Link wird gesendet …' : 'Link anfordern'}
            </button>

            <Link to={authPath('/login', returnTo)} className="min-h-11 py-3 text-center text-sm font-bold text-indigo-700 hover:underline">
              Zurück zur Anmeldung
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
