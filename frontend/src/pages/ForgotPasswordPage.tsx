import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch {
      // Ignore errors — always show success to prevent user enumeration
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card max-w-sm w-full">
        <h1 className="mb-2">Passwort vergessen</h1>
        <p className="text-sm text-gray-500 mb-6">
          Gib deine E-Mail-Adresse ein und wir schicken dir einen Link zum Zurücksetzen.
        </p>

        {submitted ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              Falls ein Account mit dieser E-Mail existiert, wurde ein Link verschickt.
            </p>
            <Link to="/login" className="text-sm text-center text-indigo-600 hover:underline">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
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

            <button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? 'Wird gesendet...' : 'Link anfordern'}
            </button>

            <p className="text-sm text-center text-gray-500">
              <Link to="/login" className="text-indigo-600 hover:underline">
                Zurück zur Anmeldung
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
