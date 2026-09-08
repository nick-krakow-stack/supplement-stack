import { useEffect, useRef, useState } from 'react';
import type { CreatorParty } from '../api/creatorSharing';
import {
  getCreatorPublicProfileSettings, submitCreatorPublicProfile, withdrawCreatorPublicProfile,
  type CreatorPublicProfileState,
} from '../api/creatorPublicProfile';
import { SITE_ORIGIN } from '../../../functions/lib/route-head-contract.mjs';

const statusLabels = { pending: 'Wird geprüft · nicht öffentlich', approved: 'Öffentlich', rejected: 'Bitte überarbeiten · nicht öffentlich', withdrawn: 'Ausgeblendet · nicht öffentlich' };

function responseStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function OwnerProfileSettings({ party }: { party: CreatorParty }) {
  const [data, setData] = useState<CreatorPublicProfileState | null>(null);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const request = useRef(0);
  const dirty = useRef(false);

  useEffect(() => {
    const sequence = ++request.current;
    setLoading(true); setError(null); setConsent(false); setConfirmWithdraw(false);
    getCreatorPublicProfileSettings(party.id).then((next) => {
      if (sequence !== request.current) return;
      if (next.party.id !== party.id) throw new Error('Unexpected Creator identity.');
      setData(next);
      if (!dirty.current) setDescription(next.profile?.description ?? '');
      setStale(false);
    }).catch((caught: unknown) => {
      if (sequence !== request.current) return;
      setError(responseStatus(caught) === 403
        ? 'Du darfst diese öffentliche Seite nicht verwalten. Bitte prüfe dein Creator-Konto.'
        : 'Die Einstellungen konnten nicht geladen werden. Bitte versuche es noch einmal.');
    }).finally(() => { if (sequence === request.current) setLoading(false); });
    return () => { request.current += 1; };
  }, [party.id, attempt]);

  const normalized = description.trim().normalize('NFC');
  const length = [...normalized].length;
  const validDescription = length >= 40 && length <= 180;
  const publicUrl = data ? `${SITE_ORIGIN}/creator/${encodeURIComponent(data.party.slug)}` : '';
  const isPublic = data?.profile?.status === 'approved' && data.profile.identity_matches && Boolean(data.profile.published_at);
  const profile = data?.profile;

  const apply = async (action: 'submit' | 'withdraw') => {
    if (!data || loading || busy || stale || (action === 'submit' && (!consent || !validDescription)) || (action === 'withdraw' && !profile)) return;
    const sequence = ++request.current;
    setBusy(true); setError(null); setNotice(null);
    try {
      const next = action === 'submit'
        ? await submitCreatorPublicProfile(party.id, { expected_version: profile?.version ?? null, expected_identity_hash: data.identity_hash, description: normalized, consent: true, consent_version: data.consent_version })
        : await withdrawCreatorPublicProfile(party.id, profile!.version);
      if (sequence !== request.current) return;
      if (next.party.id !== party.id) throw new Error('Unexpected Creator identity.');
      setData(next); setConsent(false); setConfirmWithdraw(false);
      if (action === 'submit') { dirty.current = false; setDescription(next.profile?.description ?? normalized); }
      setNotice(action === 'submit'
        ? 'Dein Vorstellungstext wurde zur Prüfung eingereicht. Die Seite bleibt bis zur Freigabe ausgeblendet.'
        : 'Deine öffentliche Creator-Seite ist ausgeblendet. Eine ausstehende Prüfung ist damit beendet. Bereits geteilte Empfehlungslinks bleiben unverändert.');
    } catch (caught: unknown) {
      if (sequence !== request.current) return;
      const status = responseStatus(caught);
      if (status === 409 || status === 403) { setStale(true); setConsent(false); setConfirmWithdraw(false); }
      setError(status === 409
        ? 'Die Angaben wurden inzwischen geändert. Lade den aktuellen Stand neu und prüfe ihn vor dem nächsten Schritt. Deine Texteingabe bleibt erhalten.'
        : status === 403 ? 'Du darfst diese öffentliche Seite nicht mehr verwalten. Lade den aktuellen Stand neu.'
          : status === 400 ? 'Die Eingabe konnte nicht übernommen werden. Nutze 40 bis 180 Zeichen ohne Links oder Formatierungen und bestätige die Veröffentlichung.'
            : 'Der Vorgang konnte nicht bestätigt werden. Lade den aktuellen Stand neu, bevor du es erneut versuchst.');
      // An uncertain response may follow a successful write. Reconcile explicitly,
      // never resubmit against an assumed old version.
      if (status !== 400) setStale(true);
    } finally { if (sequence === request.current) setBusy(false); }
  };

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="creator-public-profile-heading">
      <h2 id="creator-public-profile-heading" className="text-xl font-black text-slate-950">Öffentliche Creator-Seite</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Deine freiwillige Vorstellung für alle. Sie ist unabhängig von deinen geteilten Empfehlungen.</p>
      {loading && <p className="mt-4 text-sm text-slate-600" role="status">Einstellungen werden geladen…</p>}
      {error && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950" role="alert">{error}</p>}
      {notice && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950" role="status">{notice}</p>}
      {!loading && (error || stale) && <button type="button" className="btn btn-secondary mt-3" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Aktuellen Stand neu laden</button>}
      {!loading && data && (
        <div className="mt-4 space-y-4">
          <div className="flex min-w-0 items-center gap-3">
            {data.party.profile_image_url && <img src={data.party.profile_image_url} alt={`Öffentliches Profilbild von ${data.party.name}`} referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-full object-cover" />}
            <div className="min-w-0"><p className="break-words font-bold text-slate-950">{data.party.name}</p><p className="text-sm text-slate-600">Name, Kurzname und Bild stammen aus deinem Creator-Konto.</p></div>
          </div>
          <p className="text-sm font-bold text-slate-800">{profile && !profile.identity_matches && profile.status !== 'withdrawn' ? 'Creator-Angaben geändert · nicht öffentlich. Bitte erneut zur Prüfung einreichen.' : profile?.status === 'approved' && !isPublic ? 'Nicht öffentlich. Bitte den aktuellen Stand neu laden.' : profile ? statusLabels[profile.status] : 'Noch nicht öffentlich'}</p>
          <label className="block text-sm font-bold text-slate-700">Adresse deiner öffentlichen Seite<input className="input mt-1 w-full min-w-0 font-normal" readOnly value={publicUrl} onFocus={event => event.target.select()} /></label>
          {isPublic && <a className="inline-block text-sm font-bold text-indigo-700 underline" href={publicUrl} target="_blank" rel="noopener noreferrer">Öffentliche Seite ansehen</a>}
          {profile?.moderation_reason && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">Rückmeldung zur Prüfung</p><p className="mt-1 whitespace-pre-wrap break-words">{profile.moderation_reason}</p></div>}
          <form onSubmit={event => { event.preventDefault(); void apply('submit'); }}>
            <label className="block text-sm font-bold text-slate-700" htmlFor="creator-public-description">Dein Vorstellungstext</label>
            <p id="creator-public-description-help" className="mt-1 text-sm leading-6 text-slate-600">Stell dich kurz vor: 40 bis 180 Zeichen, ohne Links oder Formatierungen. Bitte keine Produktwerbung, Gesundheitsversprechen oder privaten Kontaktangaben.</p>
            <textarea id="creator-public-description" aria-describedby="creator-public-description-help creator-public-description-length" className="input mt-2 w-full min-w-0" rows={3} value={description} disabled={busy} onChange={event => { dirty.current = true; setDescription(event.target.value); setConsent(false); }} />
            <p id="creator-public-description-length" className={`mt-1 text-sm ${length > 180 ? 'text-amber-800' : 'text-slate-600'}`}>{length} von 180 Zeichen</p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <p className="font-bold">Mit dem Absenden wird ein bisheriges Profil ausgeblendet, bis der neue Text freigegeben ist.</p>
              <p className="mt-1">Veröffentlicht werden dein Creator-Name, dein öffentliches Profilbild und dieser Vorstellungstext. Deine privaten Stacks, Empfehlungen und Kontodaten werden dadurch nicht veröffentlicht.</p>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-800"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={consent} disabled={busy || stale} onChange={event => setConsent(event.target.checked)} /><span>Ich möchte diese Angaben nach der Freigabe öffentlich zeigen. Die Seite kann in Suchmaschinen erscheinen.</span></label>
            <button type="submit" className="btn btn-primary mt-4" disabled={!consent || !validDescription || busy || stale}>{busy ? 'Bitte warten…' : 'Zur Prüfung und Veröffentlichung senden'}</button>
          </form>
          {profile && profile.status !== 'withdrawn' && (
            <div className="border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
              <p>Du kannst die Seite jederzeit ausblenden oder eine ausstehende Prüfung abbrechen. Bereits geteilte Empfehlungslinks bleiben unverändert. Suchmaschinen können die Seite noch eine Zeit lang anzeigen.</p>
              {!confirmWithdraw
                ? <button type="button" className="btn btn-secondary mt-3" disabled={busy || stale} onClick={() => setConfirmWithdraw(true)}>{profile.status === 'pending' ? 'Prüfung abbrechen und Seite ausblenden' : 'Öffentliche Seite ausblenden'}</button>
                : <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="font-bold text-amber-950">Die Seite ist danach hier nicht mehr öffentlich. Eine ausstehende Prüfung wird beendet.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" className="btn btn-primary" disabled={busy || stale} onClick={() => void apply('withdraw')}>Jetzt ausblenden</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirmWithdraw(false)}>Abbrechen</button></div></div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function CreatorPublicProfileSettings({ party, initiallyExpanded = true }: { party: CreatorParty; initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [opened, setOpened] = useState(initiallyExpanded);
  if (party.role !== 'owner' || party.status !== 'active') return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black text-slate-950">Öffentliche Creator-Seite</h2><p className="mt-2 text-sm leading-6 text-slate-600">Nur der Inhaber des aktiven Creator-Kontos kann die öffentliche Seite veröffentlichen oder ausblenden. Deine Rechte für Empfehlungen bleiben unverändert.</p></section>;
  // Remounting isolates drafts, consent and late responses across Creator identities.
  return <div className="space-y-3">
    {!initiallyExpanded && <div className="rounded-2xl border border-slate-200 bg-white p-4"><button type="button" className="text-left font-bold text-indigo-800" aria-expanded={expanded} aria-controls="creator-public-profile-panel" onClick={() => { setOpened(true); setExpanded(value => !value); }}>Öffentliche Creator-Seite verwalten</button><p className="mt-1 text-sm text-slate-600">Freiwillige Vorstellung, Sichtbarkeit und Ausblenden – getrennt von deinen Empfehlungen.</p></div>}
    {opened && <div id="creator-public-profile-panel" hidden={!expanded}><OwnerProfileSettings key={`${party.id}:${party.name}:${party.slug}`} party={party} /></div>}
  </div>;
}
