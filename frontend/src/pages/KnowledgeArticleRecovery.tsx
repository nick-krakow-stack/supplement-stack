import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiPath } from '../api/base';
import { isKnowledgeOverviewResponse, readCachedKnowledgeOverview } from '../lib/knowledgeOverviewClient';
import { knowledgeNavigationState } from '../lib/knowledgeNavigation';
import type { KnowledgeArticleOverviewItem } from '../types';

export default function KnowledgeArticleRecovery({ missing, slug, onRetry }: { missing: boolean; slug: string; onRetry: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<KnowledgeArticleOverviewItem[]>([]);
  const navigationState = knowledgeNavigationState(location.state);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const select = (articles: KnowledgeArticleOverviewItem[]) => {
      if (!active) return;
      const words = slug.toLowerCase().split('-').filter((word) => word.length > 2);
      const matching = articles.filter((article) => words.some((word) => `${article.slug} ${article.title}`.toLowerCase().includes(word)));
      setSuggestions((matching.length ? matching : articles).slice(0, 3));
    };
    const cached = readCachedKnowledgeOverview();
    if (cached) select(cached.articles);
    else void fetch(apiPath('/knowledge'), { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (isKnowledgeOverviewResponse(data)) select(data.articles);
    }).catch(() => undefined);
    return () => { active = false; controller.abort(); };
  }, [slug]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 tabIndex={-1} className="text-3xl font-black text-slate-950">{missing ? 'Artikel nicht gefunden' : 'Artikel gerade nicht erreichbar'}</h1>
      <p role="status" className="mt-4 text-base text-slate-600">{missing ? 'Unter diesem Link ist kein veröffentlichter Artikel verfügbar. Suche hier nach dem Wirkstoff.' : 'Der Artikel konnte gerade nicht geladen werden. Bitte versuche es erneut oder suche in der Wissensübersicht.'}</p>
      {!missing && <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl bg-blue-600 px-4 font-bold text-white">Erneut versuchen</button>}
      <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); navigate(`/wissen${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`, { state: navigationState }); }}>
        <label className="min-w-0 flex-1 text-sm font-bold text-slate-700">Wirkstoff suchen<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="z. B. Vitamin D oder Magnesium" className="mt-2 block w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base" /></label>
        <button type="submit" className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Suchen</button>
      </form>
      {suggestions.length > 0 && <nav className="mt-6" aria-label="Weitere Wissensartikel"><h2 className="text-lg font-bold text-slate-900">Weitere Wissensartikel</h2><ul className="mt-2 space-y-2">{suggestions.map((article) => <li key={article.slug}><Link to={`/wissen/${article.slug}`} state={navigationState} className="inline-flex min-h-11 items-center text-base font-semibold text-blue-700 underline">{article.title}</Link></li>)}</ul></nav>}
    </section>
  );
}
