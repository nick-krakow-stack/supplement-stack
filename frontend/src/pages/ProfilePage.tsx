import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  changePassword,
  deleteAccount,
  downloadMyData,
  resendVerificationEmail,
  updateMe,
} from '../api/auth';
import {
  initializeAnalytics,
  persistAnalyticsConsent,
  readStoredAnalyticsConsent,
  revokeAnalyticsConsent,
  type AnalyticsConsent,
} from '../lib/analytics';
import PasswordField from '../components/PasswordField';
import StatusMessage from '../components/StatusMessage';

const DELETE_CONFIRM_PHRASE = 'LÖSCHEN';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Datum nicht verfügbar';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [age, setAge] = useState('');
  const [guidelineSource, setGuidelineSource] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyCooldown, setVerifyCooldown] = useState(0);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwRepeat, setPwRepeat] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent | null>(() => readStoredAnalyticsConsent());

  const [delConfirmPhrase, setDelConfirmPhrase] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [delSubmitting, setDelSubmitting] = useState(false);

  const initialAge = user?.age != null ? String(user.age) : '';
  const initialGuidelineSource = user?.guideline_source ?? '';
  const profileDirty = age !== initialAge || guidelineSource !== initialGuidelineSource;

  useEffect(() => {
    setAge(initialAge);
    setGuidelineSource(initialGuidelineSource);
  }, [initialAge, initialGuidelineSource]);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = window.setInterval(() => setVerifyCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [verifyCooldown]);

  const guidelineExplanation = useMemo(() => {
    if (guidelineSource === 'studien') return 'Studienmengen werden zuerst gezeigt. Offizielle Referenzwerte bleiben weiterhin sichtbar.';
    if (guidelineSource === 'DGE') return 'Offizielle Referenzwerte werden zuerst gezeigt. Studien bleiben weiterhin sichtbar.';
    return 'Du hast noch nichts ausgewählt. Bis dahin werden offizielle Referenzwerte zuerst gezeigt.';
  }, [guidelineSource]);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    if (!profileDirty) {
      setProfileMessage('Es gibt keine ungespeicherten Änderungen.');
      return;
    }

    const parsedAge = age.trim() === '' ? null : Number(age);
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setProfileError('Bitte trage ein Alter zwischen 1 und 120 Jahren ein oder wähle „Keine Angabe“.');
      return;
    }

    const payload: { age?: number | null; guideline_source?: 'DGE' | 'studien' | null } = {};
    if (age !== initialAge) payload.age = parsedAge;
    if (guidelineSource !== initialGuidelineSource) {
      payload.guideline_source = guidelineSource === '' ? null : guidelineSource as 'DGE' | 'studien';
    }

    setSubmitting(true);
    try {
      await updateMe(payload);
      await refreshUser();
      setProfileMessage('Deine Profilangaben wurden gespeichert.');
    } catch {
      setProfileError('Deine Angaben konnten nicht gespeichert werden. Bitte prüfe sie und versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwNew.length < 8) {
      setPwError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (pwNew !== pwRepeat) {
      setPwError('Die neuen Passwörter stimmen nicht überein.');
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
    } catch (error) {
      setPwError(error instanceof Error ? error.message : 'Das Passwort konnte nicht geändert werden.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyMessage(null);
    setVerifyError(null);
    setVerifySubmitting(true);
    try {
      const result = await resendVerificationEmail('/profile');
      setVerifyMessage(`${result.message} Zieladresse: ${user?.email ?? ''}`);
      setVerifyCooldown(60);
      if (result.already_verified) await refreshUser();
    } catch {
      setVerifyError('Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.');
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleExport = async () => {
    setExportMessage(null);
    setExportError(null);
    setExporting(true);
    try {
      const blob = await downloadMyData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `supplement-stack-daten-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage('Deine Datendatei wurde erstellt und heruntergeladen.');
    } catch {
      setExportError('Deine Daten konnten nicht heruntergeladen werden. Bitte versuche es erneut.');
    } finally {
      setExporting(false);
    }
  };

  const changeAnalyticsConsent = (choice: AnalyticsConsent) => {
    persistAnalyticsConsent(choice);
    if (choice === 'accepted') initializeAnalytics();
    else revokeAnalyticsConsent();
    setAnalyticsConsent(choice);
  };

  const deleteAllowed = delConfirmPhrase === DELETE_CONFIRM_PHRASE && delPassword.length > 0 && !delSubmitting;

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setDelError(null);
    if (!deleteAllowed) return;
    setDelSubmitting(true);
    try {
      await deleteAccount({ password: delPassword });
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      setDelError(error instanceof Error ? error.message : 'Das Konto konnte nicht gelöscht werden.');
      setDelSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6">Mein Profil</h1>

      <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="account-heading">
        <h2 id="account-heading" className="mb-3">Konto und E-Mail</h2>
        <p className="text-sm text-gray-500">E-Mail-Adresse</p>
        <p className="break-all font-semibold text-gray-900">{user?.email}</p>
        {user?.email_verified_at ? (
          <StatusMessage tone="success" className="mt-3">E-Mail bestätigt am {formatDate(user.email_verified_at)}.</StatusMessage>
        ) : (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Deine E-Mail-Adresse ist noch nicht bestätigt.</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">Wir senden den Link an {user?.email}. Er ist 48 Stunden gültig. Prüfe bitte auch den Spam-Ordner.</p>
            <button
              type="button"
              onClick={() => void handleResendVerification()}
              disabled={verifySubmitting || verifyCooldown > 0}
              className="mt-3 min-h-11 rounded-xl bg-white px-4 py-2 text-sm font-bold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifySubmitting ? 'E-Mail wird gesendet …' : verifyCooldown > 0 ? `Erneut senden in ${verifyCooldown} s` : 'Bestätigungs-E-Mail senden'}
            </button>
            {verifyMessage && <StatusMessage tone="success" className="mt-3">{verifyMessage}</StatusMessage>}
            {verifyError && <StatusMessage tone="error" className="mt-3">{verifyError}</StatusMessage>}
          </div>
        )}
      </section>

      <section id="preferences" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="preferences-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="preferences-heading">Optionale Angaben</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Du kannst beide Angaben leer lassen oder jederzeit wieder entfernen.</p>
          </div>
          {profileDirty && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900" role="status">Noch nicht gespeichert</span>}
        </div>

        <form onSubmit={handleProfileSubmit} className="mt-5 flex flex-col gap-5">
          <div>
            <label htmlFor="age" className="mb-1 block text-sm font-semibold text-gray-700">Alter</label>
            <p id="age-help" className="mb-2 text-sm leading-6 text-slate-600">Das Alter hilft dabei, vorhandene allgemeine Referenzwerte der passenden Altersgruppe anzuzeigen. Es wird nicht für Diagnosen oder persönliche Dosierungsangaben verwendet.</p>
            <div className="flex gap-2">
              <input
                id="age"
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="Keine Angabe"
                aria-describedby="age-help"
              />
              {age && <button type="button" onClick={() => setAge('')} className="min-h-11 shrink-0 bg-white px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200">Angabe entfernen</button>}
            </div>
          </div>

          <div>
            <label htmlFor="guideline_source" className="mb-1 block text-sm font-semibold text-gray-700">Welche Quellen möchtest du zuerst sehen?</label>
            <select
              id="guideline_source"
              value={guidelineSource}
              onChange={(event) => setGuidelineSource(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Bitte auswählen</option>
              <option value="DGE">Offizielle Referenzwerte</option>
              <option value="studien">Studien</option>
            </select>
            <p className={`mt-2 rounded-xl px-3 py-2 text-sm leading-6 ${guidelineSource ? 'bg-slate-50 text-slate-700' : 'bg-blue-50 font-semibold text-blue-900'}`}>{guidelineExplanation}</p>
          </div>

          {profileError && <StatusMessage tone="error">{profileError}</StatusMessage>}
          {profileMessage && <StatusMessage tone="success">{profileMessage}</StatusMessage>}

          <button type="submit" disabled={submitting || !profileDirty} className="min-h-11 self-start disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Änderungen werden gespeichert …' : 'Änderungen speichern'}
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="password-heading">
        <h2 id="password-heading">Passwort ändern</h2>
        <form onSubmit={handlePasswordSubmit} className="mt-4 flex flex-col gap-4">
          <PasswordField id="pw-current" label="Aktuelles Passwort" autoComplete="current-password" value={pwCurrent} onChange={(event) => setPwCurrent(event.target.value)} required />
          <PasswordField id="pw-new" label="Neues Passwort" autoComplete="new-password" minLength={8} value={pwNew} onChange={(event) => setPwNew(event.target.value)} required hint="Mindestens 8 Zeichen; am besten ein Passwort, das du nur hier nutzt." />
          <PasswordField id="pw-repeat" label="Neues Passwort wiederholen" autoComplete="new-password" minLength={8} value={pwRepeat} onChange={(event) => setPwRepeat(event.target.value)} required />
          {pwError && <StatusMessage tone="error">{pwError}</StatusMessage>}
          {pwSuccess && <StatusMessage tone="success">Passwort geändert. Du bleibst auf diesem Gerät angemeldet. Bereits angemeldete andere Geräte bleiben bis zum Ende ihrer Sitzung angemeldet.</StatusMessage>}
          <button type="submit" disabled={pwSubmitting} className="min-h-11 self-start">{pwSubmitting ? 'Passwort wird gespeichert …' : 'Passwort ändern'}</button>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm" aria-labelledby="privacy-heading">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-blue-700" aria-hidden="true" />
          <div>
            <h2 id="privacy-heading">Daten und Einwilligungen</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Hier kannst du deine gespeicherten Daten herunterladen und die optionale Nutzungsanalyse verwalten.</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-900">Speicherung deiner Stack- und Produktdaten</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Zugestimmt am {formatDate(user?.health_consent_at)}. Diese Einwilligung ist nötig, solange dein Konto gesundheitsnahe Stack-Daten speichert.
            Du kannst sie widerrufen, indem du unten dein Konto und diese Daten löschst.
          </p>
        </div>

        <fieldset className="mt-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 font-bold text-slate-900">Optionale Nutzungsanalyse</legend>
          <p className="mb-3 text-sm leading-6 text-slate-600">Hilft uns zu verstehen, welche Seiten genutzt werden. Deine Stack- und Produktinhalte werden dafür nicht als Statistik-Inhalt übertragen. Die App funktioniert auch, wenn du ablehnst.</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
              <input type="radio" name="analytics-consent" checked={analyticsConsent === 'accepted'} onChange={() => changeAnalyticsConsent('accepted')} /> Zulassen
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
              <input type="radio" name="analytics-consent" checked={analyticsConsent === 'declined'} onChange={() => changeAnalyticsConsent('declined')} /> Nicht zulassen
            </label>
          </div>
          {analyticsConsent === null && <p className="mt-2 text-sm font-semibold text-amber-800" role="status">Du hast noch nicht entschieden.</p>}
        </fieldset>

        <button type="button" onClick={() => void handleExport()} disabled={exporting} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          <Download className="h-5 w-5" aria-hidden="true" />
          {exporting ? 'Datendatei wird erstellt …' : 'Meine Daten herunterladen'}
        </button>
        <p className="mt-2 text-sm leading-6 text-slate-600">Du erhältst eine lesbare JSON-Datei mit deinem Konto, deinen Stacks, eigenen Produkten, Einwilligungen und zugehörigen Aktivitäten.</p>
        {exportMessage && <StatusMessage tone="success" className="mt-3">{exportMessage}</StatusMessage>}
        {exportError && <StatusMessage tone="error" className="mt-3">{exportError}</StatusMessage>}
      </section>

      <section id="delete-account" className="mb-8 mt-4 rounded-2xl border border-red-200 bg-white p-6 shadow-sm" aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="text-red-800">Konto endgültig löschen</h2>
        <StatusMessage tone="warning" className="mt-3">
          <p>Gelöscht werden deine persönlichen Kontodaten, deine Stacks samt Zusammenstellung, deine eigenen Produktentwürfe, gespeicherte Einstellungen und Einwilligungsdaten.</p>
          <p className="mt-2">Öffentlich geteilte Creator-Empfehlungen können als Inhalt der Creator-Organisation bestehen bleiben. Deine Kontozuordnung wird daraus entfernt. Die Kontolöschung kann nicht rückgängig gemacht werden.</p>
        </StatusMessage>
        <p className="mt-3 text-sm leading-6 text-slate-700">Möchtest du vorher eine Kopie behalten? Nutze oben zuerst <button type="button" onClick={() => void handleExport()} className="rounded-none bg-transparent p-0 font-bold text-blue-700 underline">Meine Daten herunterladen</button>.</p>

        <form onSubmit={handleDeleteAccount} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="del-confirm" className="mb-1 block text-sm font-semibold text-gray-700">Tippe <span className="font-mono">{DELETE_CONFIRM_PHRASE}</span>, um die endgültige Löschung zu bestätigen</label>
            <input id="del-confirm" type="text" autoComplete="off" value={delConfirmPhrase} onChange={(event) => setDelConfirmPhrase(event.target.value)} placeholder={DELETE_CONFIRM_PHRASE} />
          </div>
          <PasswordField id="del-password" label="Aktuelles Passwort" autoComplete="current-password" value={delPassword} onChange={(event) => setDelPassword(event.target.value)} />
          {delError && <StatusMessage tone="error">{delError}</StatusMessage>}
          <button type="submit" disabled={!deleteAllowed} className="min-h-11 self-start bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300">
            {delSubmitting ? 'Konto wird gelöscht …' : 'Konto und alle Daten endgültig löschen'}
          </button>
        </form>
      </section>

      <p className="sr-only"><Link to="/datenschutz">Datenschutzerklärung öffnen</Link></p>
    </div>
  );
}
