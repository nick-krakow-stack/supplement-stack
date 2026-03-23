import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateMe } from '../api/auth';

export default function ProfilePage() {
  const { user } = useAuth();

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [diet, setDiet] = useState('');
  const [goals, setGoals] = useState('');
  const [guidelineSource, setGuidelineSource] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setAge(user.age != null ? String(user.age) : '');
      setGender(user.gender ?? '');
      setWeight(user.weight != null ? String(user.weight) : '');
      setDiet(user.diet ?? '');
      setGoals(user.goals ?? '');
      setGuidelineSource(user.guideline_source ?? '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await updateMe({
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        weight: weight ? Number(weight) : undefined,
        diet: diet || undefined,
        goals: goals || undefined,
        guideline_source: guidelineSource || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Speichern fehlgeschlagen.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-6">Mein Profil</h1>

      <div className="card mb-4">
        <p className="text-sm text-gray-500 mb-1">E-Mail-Adresse</p>
        <p className="font-medium text-gray-900">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">Rolle: {user?.role}</p>
      </div>

      <div className="card">
        <h2>Profil bearbeiten</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
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
              <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                Gewicht (kg)
              </label>
              <input
                id="weight"
                type="number"
                min={1}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="z. B. 75"
              />
            </div>
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
            <label htmlFor="diet" className="block text-sm font-medium text-gray-700 mb-1">
              Ernährungsweise
            </label>
            <input
              id="diet"
              type="text"
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              placeholder="z. B. vegan, vegetarisch, omnivor"
            />
          </div>

          <div>
            <label htmlFor="goals" className="block text-sm font-medium text-gray-700 mb-1">
              Ziele
            </label>
            <textarea
              id="goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="z. B. Energie steigern, Immunsystem stärken"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              <option value="Studien">Studien</option>
              <option value="Influencer">Influencer</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Profil erfolgreich gespeichert.
            </p>
          )}

          <button type="submit" disabled={submitting} className="self-start">
            {submitting ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
