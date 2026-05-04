import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateMe, changePassword, deleteAccount } from '../api/auth';

const DELETE_CONFIRM_PHRASE = 'LÖSCHEN';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [diet, setDiet] = useState('');
  const [goals, setGoals] = useState('');
  const [guidelineSource, setGuidelineSource] = useState('');
  const [isSmoker, setIsSmoker] = useState<boolean>(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Passwort-Änderung
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwRepeat, setPwRepeat] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Account-Löschung
  const [delConfirmPhrase, setDelConfirmPhrase] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [delSubmitting, setDelSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setAge(user.age != null ? String(user.age) : '');
      setGender(user.gender ?? '');
      setWeight(user.weight != null ? String(user.weight) : '');
      setDiet(user.diet ?? '');
      setGoals(user.goals ?? '');
      setGuidelineSource(user.guideline_source ?? '');
      setIsSmoker(user.is_smoker === 1);
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
        is_smoker: isSmoker ? 1 : 0,
      });
      await refreshUser();
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (pwNew.length < 8) {
      setPwError('Neues Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (pwNew !== pwRepeat) {
      setPwError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }
    if (pwNew === pwCurrent) {
      setPwError('Neues Passwort muss sich vom aktuellen unterscheiden.');
      return;
    }

    setPwSubmitting(true);
    try {
      await changePassword({ current_password: pwCurrent, new_password: pwNew });
      setPwCurrent('');
      setPwNew('');
      setPwRepeat('');
      setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Passwort konnte nicht geändert werden.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const deleteAllowed =
    delConfirmPhrase === DELETE_CONFIRM_PHRASE && delPassword.length > 0 && !delSubmitting;

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelError(null);
    if (!deleteAllowed) return;

    setDelSubmitting(true);
    try {
      await deleteAccount({ password: delPassword });
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDelError(err instanceof Error ? err.message : 'Account konnte nicht gelöscht werden.');
      setDelSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-6">Mein Profil</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <p className="text-sm text-gray-500 mb-1">E-Mail-Adresse</p>
        <p className="font-medium text-gray-900">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">Rolle: {user?.role}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white resize-none"
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
            >
              <option value="">Keine Angabe</option>
              <option value="DGE">DGE</option>
              <option value="Studien">Studien</option>
              <option value="Influencer">Influencer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raucherstatus
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="smoker"
                  checked={!isSmoker}
                  onChange={() => setIsSmoker(false)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Nichtraucher</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="smoker"
                  checked={isSmoker}
                  onChange={() => setIsSmoker(true)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Raucher</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Wird für Sicherheitshinweise verwendet (z. B. Beta-Carotin bei Rauchern).
            </p>
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

      {/* Sektion: Passwort ändern */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4">
        <h2>Passwort ändern</h2>

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <label htmlFor="pw-current" className="block text-sm font-medium text-gray-700 mb-1">
              Aktuelles Passwort
            </label>
            <input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              required
              className="w-full min-h-[44px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
            />
          </div>

          <div>
            <label htmlFor="pw-new" className="block text-sm font-medium text-gray-700 mb-1">
              Neues Passwort
            </label>
            <input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              required
              className="w-full min-h-[44px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">Mindestens 8 Zeichen.</p>
          </div>

          <div>
            <label htmlFor="pw-repeat" className="block text-sm font-medium text-gray-700 mb-1">
              Neues Passwort wiederholen
            </label>
            <input
              id="pw-repeat"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={pwRepeat}
              onChange={(e) => setPwRepeat(e.target.value)}
              required
              className="w-full min-h-[44px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
            />
          </div>

          {pwError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {pwError}
            </p>
          )}

          {pwSuccess && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Passwort erfolgreich geändert.
            </p>
          )}

          <button
            type="submit"
            disabled={pwSubmitting}
            className="self-start min-h-[44px]"
          >
            {pwSubmitting ? 'Wird gespeichert...' : 'Passwort ändern'}
          </button>
        </form>
      </div>

      {/* Sektion: Account löschen (DSGVO Art. 17) */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 mt-4 mb-8">
        <h2 className="text-red-700">Account löschen</h2>

        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
          <p className="font-medium mb-1">Diese Aktion ist endgültig.</p>
          <p>
            Alle deine Stacks, eigenen Produkte, deine Wunschliste und deine Profildaten werden
            unwiderruflich gelöscht. Die Löschung erfolgt sofort und kann nicht rückgängig gemacht
            werden.
          </p>
        </div>

        <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4 mt-4">
          <div>
            <label htmlFor="del-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Tippe <span className="font-mono font-semibold">{DELETE_CONFIRM_PHRASE}</span> zur
              Bestätigung
            </label>
            <input
              id="del-confirm"
              type="text"
              autoComplete="off"
              value={delConfirmPhrase}
              onChange={(e) => setDelConfirmPhrase(e.target.value)}
              placeholder={DELETE_CONFIRM_PHRASE}
              className="w-full min-h-[44px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-white"
            />
          </div>

          <div>
            <label htmlFor="del-password" className="block text-sm font-medium text-gray-700 mb-1">
              Aktuelles Passwort
            </label>
            <input
              id="del-password"
              type="password"
              autoComplete="current-password"
              value={delPassword}
              onChange={(e) => setDelPassword(e.target.value)}
              className="w-full min-h-[44px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-white"
            />
          </div>

          {delError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {delError}
            </p>
          )}

          <button
            type="submit"
            disabled={!deleteAllowed}
            className="self-start min-h-[44px] bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-2"
          >
            {delSubmitting ? 'Account wird gelöscht...' : 'Account endgültig löschen'}
          </button>
        </form>
      </div>
    </div>
  );
}
