import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [guidelineSource, setGuidelineSource] = useState('');
  const [healthConsent, setHealthConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, { health_consent: healthConsent });
      navigate('/');
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
            <p className="text-xs text-gray-500 mb-3">Optional – kann später geändert werden</p>

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
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Geschlecht
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="input"
                >
                  <option value="">Keine Angabe</option>
                  <option value="männlich">Männlich</option>
                  <option value="weiblich">Weiblich</option>
                  <option value="divers">Divers</option>
                </select>
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
                  <option value="Studien">Studien</option>
                  <option value="Influencer">Influencer</option>
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
                Ich stimme der Verarbeitung meiner Gesundheitsdaten (Alter, Geschlecht, Raucherstatus)
                zur Berechnung personalisierter Dosierungsempfehlungen zu.{' '}
                <span className="text-xs text-gray-500">(DSGVO Art. 9 – erforderlich)</span>
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
