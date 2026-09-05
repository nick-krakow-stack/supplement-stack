import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bookmark, Copy, Share2 } from 'lucide-react';
import { knowledgeNavigationState, knowledgeOverviewSearch, publicKnowledgeArticleUrl, readSavedKnowledgeSlugs, setKnowledgeArticleSaved } from '../lib/knowledgeNavigation';

export function KnowledgeArticleActions({ slug, title }: { slug: string; title: string }) {
  const location = useLocation();
  const navigationState = knowledgeNavigationState(location.state);
  const savedParams = new URLSearchParams(knowledgeOverviewSearch(location.search) || navigationState.overviewSearch);
  savedParams.set('saved', '1');
  const [saved, setSaved] = useState(() => readSavedKnowledgeSlugs().includes(slug));
  const [message, setMessage] = useState('');
  const [manualLink, setManualLink] = useState('');
  const url = publicKnowledgeArticleUrl(slug);
  const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setManualLink('');
      setMessage('Artikellink kopiert. Du kannst ihn jetzt einfügen und teilen.');
    } catch {
      setManualLink(url);
      setMessage('Wähle den Link aus und kopiere ihn.');
    }
  };

  const share = async () => {
    if (!navigator.share) { await copyLink(); return; }
    try {
      await navigator.share({ title, url });
      setMessage('Artikel geteilt.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      await copyLink();
    }
  };

  const toggleSaved = () => {
    try {
      setKnowledgeArticleSaved(slug, !saved);
      setSaved(!saved);
      setMessage(saved ? 'Artikel aus deiner Merkliste entfernt.' : 'Artikel auf diesem Gerät gemerkt.');
    } catch {
      setMessage('Das Merken ist in diesem Browser gerade nicht möglich. Du kannst den Artikellink kopieren.');
    }
  };

  return (
    <div className="mt-5 space-y-2" aria-label="Artikel teilen und merken">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void share()} className={buttonClass}><Share2 size={17} aria-hidden="true" />Teilen</button>
        <button type="button" onClick={() => void copyLink()} className={buttonClass}><Copy size={17} aria-hidden="true" />Link kopieren</button>
        <button type="button" onClick={toggleSaved} aria-pressed={saved} aria-describedby={`saved-hint-${slug}`} className={buttonClass}><Bookmark size={17} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />{saved ? 'Gemerkt' : 'Artikel merken'}</button>
      </div>
      <p id={`saved-hint-${slug}`} className="text-sm text-slate-600">Deine Merkliste wird in diesem Browser gespeichert. <Link to={`/wissen?${savedParams}`} state={navigationState} className="font-bold text-blue-700 underline underline-offset-4">Gemerkte Artikel ansehen</Link></p>
      <p role="status" aria-live="polite" className="text-sm font-semibold text-slate-700">{message}</p>
      {manualLink && <label className="block text-sm font-semibold text-slate-700">Artikellink<input aria-label="Artikellink zum Kopieren" value={manualLink} readOnly onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-base" /></label>}
    </div>
  );
}
