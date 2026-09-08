import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getPublicCreatorProfile } from '../api/publicCreatorProfile';
import { CREATOR_PROFILE_COPY, projectCreatorProfile, type CreatorProfilePageState } from '../../../functions/lib/creator-profile-projection.mjs';
import { isCreatorProfileSlug } from '../../../functions/lib/site-routes.mjs';
import { applyPublicRouteHead } from '../lib/publicPageHead';
import { initialCreatorProfileState } from '../lib/creatorProfileBootstrap';

export default function CreatorPublicProfilePage() {
  const { slug = '' } = useParams();
  const { pathname } = useLocation();
  const [result, setResult] = useState<{ slug: string; state: CreatorProfilePageState }>(() => ({ slug, state: initialCreatorProfileState(pathname) ?? { status: 'loading' } }));
  const [retry, setRetry] = useState(0);
  const state: CreatorProfilePageState = result.slug === slug ? result.state : { status: 'loading' };
  const { profile, title, description, head } = projectCreatorProfile(slug, state);

  useLayoutEffect(() => {
    applyPublicRouteHead(head);
    document.getElementById('creator-profile-bootstrap')?.remove();
  }, [head]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [slug]);

  useEffect(() => {
    let current = true;
    if (!isCreatorProfileSlug(slug)) {
      setResult({ slug, state: { status: 404 } });
      return;
    }
    void getPublicCreatorProfile(slug).then((next) => {
      if (current) setResult({ slug, state: { status: 200, profile: next } });
    }).catch((caught: unknown) => {
      const status = (caught as { response?: { status?: number } })?.response?.status;
      if (current) setResult({ slug, state: { status: status === 404 ? 404 : 503 } });
    });
    return () => { current = false; };
  }, [slug, retry]);

  return <article className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
    {profile && <p className="text-sm font-semibold text-slate-500">Öffentliche Creator-Seite</p>}
    {profile?.profile_image_url && <img src={profile.profile_image_url} alt="" referrerPolicy="no-referrer" width={96} height={96} className="mt-4 h-24 w-24 rounded-2xl object-cover" />}
    <h1 className="mt-3 break-words text-3xl font-extrabold text-slate-900">{title}</h1>
    <p className="mt-4 break-words text-lg leading-relaxed text-slate-700" role={state.status === 'loading' ? 'status' : undefined}>{description}</p>
    {profile && <>
      <p className="mt-6 text-sm leading-relaxed text-slate-600">{CREATOR_PROFILE_COPY.boundary}</p>
      <section className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-xl font-bold text-slate-900">{CREATOR_PROFILE_COPY.exploreHeading}</h2>
        <p className="mt-2 text-slate-700">{CREATOR_PROFILE_COPY.exploreDescription}</p>
      </section>
    </>}
    {state.status === 503 && <button type="button" onClick={() => { setResult({ slug, state: { status: 'loading' } }); setRetry((value) => value + 1); }} className="mt-6 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">Noch einmal versuchen</button>}
    <nav aria-label="Weitere Seiten" className="mt-6 flex flex-wrap gap-4 font-bold text-blue-700">
      <Link to="/wissen" className="inline-flex min-h-11 items-center underline">Wissen entdecken</Link>
      <Link to="/demo" className="inline-flex min-h-11 items-center underline">Demo ohne Konto ausprobieren</Link>
      <Link to="/" className="inline-flex min-h-11 items-center underline">Zur Startseite</Link>
    </nav>
  </article>;
}
