import { FormEvent, useState } from 'react';
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { changePassword } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { AdminBadge, AdminButton, AdminCard, AdminError, AdminPageHeader } from './AdminUi';

export default function AdministratorProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setError('Die neuen Passwoerter stimmen nicht ueberein.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.');
      return;
    }

    setSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setSuccess('Passwort wurde geaendert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passwort konnte nicht geaendert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Admin-Profil"
        subtitle="Kontodaten ansehen und Passwort ändern."
        meta={<AdminBadge tone={user?.role === 'admin' ? 'info' : 'neutral'}>{user?.role ?? 'unbekannt'}</AdminBadge>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AdminCard title="Basisinfo" padded>
          <div className="grid gap-3">
            <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-white/70 px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--admin-ink-3)]">
                <Mail size={14} />
                E-Mail
              </div>
              <div className="mt-2 break-all font-medium text-[color:var(--admin-ink)]">{user?.email ?? '-'}</div>
            </div>

            <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-white/70 px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--admin-ink-3)]">
                <ShieldCheck size={14} />
                Rolle
              </div>
              <div className="mt-2 font-medium text-[color:var(--admin-ink)]">{user?.role === 'admin' ? 'Admin' : user?.role ?? '-'}</div>
            </div>

            <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-white/70 px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--admin-ink-3)]">
                <UserRound size={14} />
                Profil
              </div>
              <div className="mt-2 grid gap-1 text-sm text-[color:var(--admin-ink-2)]">
                <div>Alter: {user?.age ?? '-'}</div>
                <div>Leitlinienquelle: {user?.guideline_source || '-'}</div>
                <div>E-Mail aktiv: {user?.email_verified_at ? 'Ja' : 'Nein'}</div>
                <div>Health Consent: {user?.health_consent ? 'Ja' : 'Nein'}</div>
              </div>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Passwort ändern" subtitle="Passwort sicher aktualisieren." padded>
          <form onSubmit={handlePasswordSubmit} className="grid gap-3">
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Aktuelles Passwort
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="admin-input mt-1"
                required
              />
            </label>

            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Neues Passwort
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="admin-input mt-1"
                required
              />
            </label>

            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Neues Passwort wiederholen
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                className="admin-input mt-1"
                required
              />
            </label>

            {error && <AdminError>{error}</AdminError>}
            {success && (
              <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-success-soft)] px-3 py-2 text-sm font-medium text-[color:var(--admin-success-ink)]">
                {success}
              </div>
            )}

            <AdminButton type="submit" variant="primary" disabled={saving} className="justify-self-start">
              <KeyRound size={14} />
              {saving ? 'Speichert...' : 'Passwort ändern'}
            </AdminButton>
          </form>
        </AdminCard>
      </div>
    </>
  );
}
