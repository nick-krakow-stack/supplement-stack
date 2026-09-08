import { useEffect, useRef, useState } from 'react';
import { getAdminCreatorPublicProfiles, reviewCreatorPublicProfile, type CreatorPublicProfileState } from '../api/creatorPublicProfile';
import { AdminButton, AdminCard, AdminEmpty } from '../pages/administrator/AdminUi';
import { SITE_ORIGIN } from '../../../functions/lib/route-head-contract.mjs';

export default function AdminCreatorPublicProfileReview() {
  const [profiles, setProfiles] = useState<CreatorPublicProfileState[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const sequence = ++request.current;
    setLoading(true); setError(null);
    getAdminCreatorPublicProfiles().then((next) => {
      if (sequence !== request.current) return;
      setProfiles(next);
      setReasons(current => Object.fromEntries(next.filter(entry => entry.profile?.status === 'pending').map(entry => [entry.party.id, current[entry.party.id] ?? ''])));
      setStale(false);
    }).catch(() => {
      if (sequence === request.current) setError('Die öffentlichen Creator-Seiten konnten nicht geladen werden. Bitte versuche es noch einmal.');
    }).finally(() => { if (sequence === request.current) setLoading(false); });
    return () => { request.current += 1; };
  }, [attempt]);

  const review = async (entry: CreatorPublicProfileState, decision: 'approve' | 'reject') => {
    const profile = entry.profile;
    const reason = (reasons[entry.party.id] ?? '').trim().normalize('NFC');
    if (busyId !== null || loading || stale || profile?.status !== 'pending' || (decision === 'approve' && !profile.identity_matches) || (decision === 'reject' && ([...reason].length < 5 || [...reason].length > 500))) return;
    const sequence = ++request.current;
    setBusyId(entry.party.id); setError(null); setNotice(null);
    try {
      const next = await reviewCreatorPublicProfile(entry.party.id, {
        expected_version: profile.version, expected_review_fingerprint: profile.review_fingerprint,
        decision, ...(decision === 'reject' ? { reason } : {}),
      });
      if (sequence !== request.current) return;
      if (next.party.id !== entry.party.id) throw new Error('Unexpected reviewed Creator identity.');
      setProfiles(current => current.map(item => item.party.id === entry.party.id ? next : item));
      setReasons(current => ({ ...current, [entry.party.id]: '' }));
      setNotice(decision === 'approve'
        ? `Die öffentliche Creator-Seite von ${entry.party.name} wurde freigegeben.`
        : `Die Seite von ${entry.party.name} bleibt nicht öffentlich. Der Inhaber sieht deine Rückmeldung.`);
    } catch (caught: unknown) {
      if (sequence !== request.current) return;
      const status = (caught as { response?: { status?: number } })?.response?.status;
      setStale(true);
      setError(status === 409
        ? 'Diese Fassung oder die Creator-Angaben wurden inzwischen geändert. Lade die Liste neu und prüfe die aktuelle Fassung. Es wurde keine Freigabe bestätigt.'
        : status === 403 ? 'Du darfst diese Seiten nicht prüfen. Lade die Liste neu oder prüfe deinen Zugang.'
          : 'Die Entscheidung konnte nicht bestätigt werden. Lade die Liste neu, bevor du weiterprüfst.');
    } finally { if (sequence === request.current) setBusyId(null); }
  };

  const pending = profiles.filter(entry => entry.profile?.status === 'pending');
  return (
    <AdminCard title="Öffentliche Creator-Seiten prüfen" subtitle="Nur bewusst eingereichte Vorstellungen freigeben. Geteilte Empfehlungen und private Stacks sind davon unabhängig." padded actions={<AdminButton onClick={() => setAttempt(value => value + 1)} disabled={loading || busyId !== null}>Liste neu laden</AdminButton>}>
      {loading && <p role="status">Creator-Seiten werden geladen…</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      {!loading && !error && pending.length === 0 && <AdminEmpty>Aktuell wartet keine öffentliche Creator-Seite auf Prüfung.</AdminEmpty>}
      {!loading && pending.map(entry => {
        const profile = entry.profile!;
        const reason = reasons[entry.party.id] ?? '';
        const reasonLength = [...reason.trim().normalize('NFC')].length;
        return <article key={`${entry.party.id}:${profile.version}`} className="mt-4 min-w-0 rounded-xl border border-slate-200 p-4" aria-labelledby={`admin-public-profile-${entry.party.id}`}>
          <div className="flex min-w-0 items-center gap-3">
            {entry.party.profile_image_url && <img src={entry.party.profile_image_url} alt={`Öffentliches Profilbild von ${entry.party.name}`} referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-full object-cover" />}
            <div className="min-w-0"><h3 id={`admin-public-profile-${entry.party.id}`} className="break-words font-bold">{entry.party.name}</h3><p className="break-all text-sm text-slate-600">{SITE_ORIGIN}/creator/{entry.party.slug}</p><p className="mt-1 text-sm text-slate-600">Fassung {profile.version} · wartet auf Prüfung · nicht öffentlich</p></div>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-slate-900">{profile.description}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Prüfe Name, Bild und Vorstellungstext. Keine Produktwerbung, Gesundheitsversprechen oder privaten Kontaktangaben freigeben. Mit der Freigabe wird genau diese Fassung öffentlich und kann in Suchmaschinen erscheinen.</p>
          {!profile.identity_matches && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Die Creator-Angaben haben sich seit der Einreichung geändert. Eine Freigabe ist nicht möglich. Bitte fordere eine neue Einreichung an.</p>}
          <label className="mt-4 block text-sm font-bold" htmlFor={`admin-public-profile-reason-${entry.party.id}`}>Rückmeldung bei Ablehnung</label>
          <p id={`admin-public-profile-reason-help-${entry.party.id}`} className="mt-1 text-sm text-slate-600">5 bis 500 Zeichen. Erkläre konkret, was der Inhaber ändern soll.</p>
          <textarea id={`admin-public-profile-reason-${entry.party.id}`} aria-describedby={`admin-public-profile-reason-help-${entry.party.id}`} className="input mt-2 w-full min-w-0" rows={2} value={reason} disabled={busyId !== null || stale} onChange={event => setReasons(current => ({ ...current, [entry.party.id]: event.target.value }))} />
          <div className="mt-3 flex flex-wrap gap-3">
            <AdminButton variant="primary" disabled={busyId !== null || stale || !profile.identity_matches} onClick={() => void review(entry, 'approve')}>Diese Fassung öffentlich freigeben</AdminButton>
            <AdminButton disabled={busyId !== null || stale || reasonLength < 5 || reasonLength > 500} onClick={() => void review(entry, 'reject')}>Mit Rückmeldung ablehnen</AdminButton>
          </div>
        </article>;
      })}
    </AdminCard>
  );
}
