import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { changePassword, deleteAccount, resendVerificationEmail, updateMe } from '../api/auth';

const DELETE_CONFIRM_PHRASE = 'LOESCHEN';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [age, setAge] = useState('');
  const [guidelineSource, setGuidelineSource] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwRepeat, setPwRepeat] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const [delConfirmPhrase, setDelConfirmPhrase] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [delSubmitting, setDelSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setAge(user.age != null ? String(user.age) : '');
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
        guideline_source: guidelineSource || undefined,
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
      setPwError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (pwNew !== pwRepeat) {
      setPwError('Die neuen Passwoerter stimmen nicht ueberein.');
      return;
    }
    if (pwNew === pwCurrent) {
      setPwError('Das neue Passwort muss sich vom aktuellen unterscheiden.');
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
      setPwError(err instanceof Error ? err.message : 'Passwort konnte nicht geaendert werden.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyMessage(null);
    setVerifyError(null);
    setVerifySubmitting(true);
    try {
      const res = await resendVerificationEmail();
      setVerifyMessage(res.message);
      if (res.already_verified) {
        await refreshUser();
      }
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Bestaetigungs-E-Mail konnte nicht gesendet werden.'
      );
    } finally {
      setVerifySubmitting(false);
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
      setDelError(err instanceof Error ? err.message : 'Account konnte nicht geloescht werden.');
      setDelSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <h1 className="mb-6">Mein Profil</h1>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm text-gray-500 mb-1">E-Mail-Adresse</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
            {user?.email_verified_at ? (
              <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                E-Mail bestaetigt
              </p>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-sm font-medium text-amber-800">E-Mail-Adresse noch nicht bestaetigt.</p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={verifySubmitting}
                  className="mt-2 min-h-11 rounded-xl bg-white px-4 py-2 text-sm font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verifySubmitting ? 'Wird gesendet...' : 'Bestaetigungs-E-Mail erneut senden'}
                </button>
                {verifyMessage && <p className="mt-2 text-sm font-medium text-emerald-700">{verifyMessage}</p>}
                {verifyError && <p className="mt-2 text-sm font-medium text-red-700">{verifyError}</p>}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Rolle: {user?.role}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2>Profil bearbeiten</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
                >
                  <option value="">Keine Angabe</option>
                  <option value="DGE">DGE</option>
                  <option value="studien">Studien</option>
                  <option value="influencer">Community-basierte Empfehlung</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Falls du dich auch an Erfahrungsberichten orientierst, waehle diese neutrale
                  Kennzeichnung.
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
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2>Passwort aendern</h2>
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
                  Passwort erfolgreich geaendert.
                </p>
              )}

              <button type="submit" disabled={pwSubmitting} className="self-start min-h-[44px]">
                {pwSubmitting ? 'Wird gespeichert...' : 'Passwort aendern'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
            <h2 className="text-red-700">Account loeschen</h2>
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
              <p className="font-medium mb-1">Diese Aktion ist definitiv.</p>
              <p>
                Alle deine Stacks, eigenen Produkte, gespeicherten App-Daten und Accountdaten werden
                unwiderruflich geloescht. Die Loeschung erfolgt sofort und kann nicht rueckgaengig
                gemacht werden.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4 mt-4">
              <div>
                <label htmlFor="del-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Tippe <span className="font-mono font-semibold">{DELETE_CONFIRM_PHRASE}</span> zur
                  Bestaetigung
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
                {delSubmitting ? 'Account wird geloescht...' : 'Account definitiv loeschen'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
